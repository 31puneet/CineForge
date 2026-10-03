from langgraph.graph import StateGraph, END
from schemas.state import FilmGraphState
from langchain_core.messages import AIMessage, SystemMessage

from core.providers import GeminiAdapter
from schemas.llm import LLMScriptData

from langchain_core.runnables import RunnableConfig
import json
import copy
from pydantic import ValidationError

async def script_agent_node(state: FilmGraphState, config: RunnableConfig):
    emitter = config["configurable"].get("emitter")
    
    # Push initial status and plan
    if emitter:
        await emitter.push("status", content="Analyzing your prompt...")
        await emitter.push("plan", steps=["Script Generation", "Character Design", "Voiceover", "Video Generation", "Editing"], current="Script Generation")

    user_prompt = state["messages"][-1]
    duration = state.get("metadata", {}).get("targetDurationSeconds", 60)
    
    adapter = GeminiAdapter()
    
    num_shots = max(1, duration // 10)
    
    approved = False
    
    while not approved:
        if emitter:
            await emitter.push("status", content="Generating script..." if state.get("script_version", 0) == 0 else "Revising script based on your feedback...")
            
        is_first_message = len(state["messages"]) == 1
        
        if is_first_message:
            system_prompt = f"""You are an expert AI Film Director. 
The target duration for the movie is {duration} seconds. You must write EXACTLY {num_shots} shots, and EVERY shot must be exactly 10 seconds long.
Brainstorm ideas for a new movie script based on the user's request.
Output your thoughts line by line."""
        else:
            system_prompt = f"""You are an expert AI Film Director. 
The target duration for the movie is {duration} seconds. You must write EXACTLY {num_shots} shots, and EVERY shot must be exactly 10 seconds long.
Based on the conversation history and your previous ideas, brainstorm revisions for the movie script.
Output your thoughts line by line."""

        messages_for_llm = [SystemMessage(content=system_prompt)] + state["messages"]
        
        # 1. Brainstorm silently (no streaming to chat) -> Wait, we want to stream now!
        think_response = AIMessage(content="")
        if emitter:
            await emitter.push("status", content="Brainstorming script ideas...")
            async for chunk in adapter.llm.astream(messages_for_llm, config=config):
                think_response.content += chunk.content
                await emitter.push("thinking", content=chunk.content)
        else:
            response = await adapter.llm.ainvoke(messages_for_llm, config=config)
            think_response = AIMessage(content=response.content)
        
        # 2. Structured Output phase
        json_prompt = f"Based on this brainstorm: {think_response.content}\n\nGenerate the final structured script. CRITICAL: You must generate EXACTLY {num_shots} shots. EVERY single shot MUST have a duration of exactly 10 seconds."
        
        # Retry mechanism for malformed JSON
        script_data_dict = None
        max_retries = 3
        for attempt in range(max_retries):
            try:
                structured_data = await adapter.aget_structured_output(json_prompt, LLMScriptData)
                script_data_dict = structured_data.model_dump()
                break
            except (json.JSONDecodeError, ValidationError) as e:
                if attempt == max_retries - 1:
                    raise Exception(f"Failed to generate structured script after {max_retries} attempts: {str(e)}")
                # Append error feedback and try again
                json_prompt += f"\n\nYour previous output failed with error: {str(e)}. Please try again."

        # Post-process to guarantee exactly 10s per shot and correct number of shots
        if script_data_dict and "shots" in script_data_dict:
            shots = script_data_dict["shots"]
            
            # Force all existing shots to be exactly 10 seconds
            for shot in shots:
                shot["duration_seconds"] = 10
                
            # Ensure exactly num_shots exist
            while len(shots) < num_shots:
                if shots:
                    new_shot = copy.deepcopy(shots[-1])
                    new_shot["shot_id"] = f"shot_{len(shots)+1}"
                    shots.append(new_shot)
                else:
                    shots.append({
                        "shot_id": f"shot_{len(shots)+1}", 
                        "visual_description": "Additional scene", 
                        "duration_seconds": 10,
                        "dialogue": "",
                        "speaker": ""
                    })
            
            if len(shots) > num_shots:
                script_data_dict["shots"] = shots[:num_shots]
                
        # Update state version
        version = state.get("script_version", 0) + 1
        state["script_version"] = version
        state["script_data"] = script_data_dict
        
        # Store in history
        history = state.get("script_history", [])
        history.append({
            "version": version,
            "data": copy.deepcopy(script_data_dict)
        })
        state["script_history"] = history
        
        # Save state manually since we will pause
        update_state_fn = config["configurable"].get("update_state")
        if update_state_fn:
            update_state_fn(state)
        
        if emitter:
            # Send message with link
            await emitter.push("message", content=f"I have drafted your script (v{version}). Take a look here:", link={"label": f"v{version}_script.json", "target": "script_tab"})
            # Request approval
            await emitter.push("approval_request", stage="script")
            
            # Pause and wait for response
            response_data = await emitter.wait_for_approval()
            approved = response_data.get("approved", False)
            reason = response_data.get("reason", "")
            
            if approved:
                await emitter.push("message", content="✅ Script approved!\nQ: Does this script look good to you?\nA: Yes\n\nCharacter agent coming soon! 🚧")
                state["approval_states"]["script_approved"] = True
                break
            else:
                summary_msg = f"🔁 Revision requested:\nQ: Does this script look good to you?\nA: No — '{reason}'\n\nLet me revise the script..."
                await emitter.push("message", content=summary_msg)
                # Append rejection feedback to messages silently so the LLM knows why it was rejected
                state["messages"].append(AIMessage(content=f"User rejected the script version {version} with this feedback: {reason}. Please revise it."))
        else:
            # If no emitter (e.g. running outside API), just auto-approve for now
            approved = True

    return state

# Build the Graph
workflow = StateGraph(FilmGraphState)

workflow.add_node("script_agent", script_agent_node)
workflow.set_entry_point("script_agent")

workflow.add_edge("script_agent", END)

# Compile the graph
app = workflow.compile()
