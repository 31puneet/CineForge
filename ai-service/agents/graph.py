from langgraph.graph import StateGraph, END
from schemas.state import FilmGraphState
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage

from core.providers import GeminiAdapter
from schemas.llm import LLMScriptData, LLMCharacterData

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
            previous_script_json = json.dumps(state.get("script_data", {}), indent=2)
            system_prompt = f"""You are an expert AI Film Director. 
The target duration for the movie is {duration} seconds. You must write EXACTLY {num_shots} shots, and EVERY shot must be exactly 10 seconds long.

Here is the previous version of the script you generated:
{previous_script_json}

Based on the conversation history and the user's feedback, brainstorm revisions for the movie script. You must modify the existing script instead of starting over.
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
        
        # Retry mechanism for malformed JSON and math validation
        script_data_dict = None
        max_retries = 3
        for attempt in range(max_retries):
            try:
                structured_data = await adapter.aget_structured_output(json_prompt, LLMScriptData)
                script_data_dict = structured_data.model_dump()
                
                # Math & Rule Validation
                shots = script_data_dict.get("shots", [])
                if len(shots) != num_shots:
                    raise ValueError(f"You generated {len(shots)} shots, but I explicitly requested EXACTLY {num_shots} shots to hit the {duration} seconds target. Each shot must be exactly 10s.")
                
                for i, shot in enumerate(shots):
                    if shot.get("duration_seconds") != 10:
                        raise ValueError(f"Shot {i+1} has a duration of {shot.get('duration_seconds')} seconds. Every single shot MUST be exactly 10 seconds.")
                        
                break
            except (json.JSONDecodeError, ValidationError, ValueError) as e:
                if attempt == max_retries - 1:
                    raise Exception(f"Failed to generate structured script after {max_retries} attempts: {str(e)}")
                # Append error feedback and try again
                json_prompt += f"\n\nYour previous output failed with error: {str(e)}. Please try again and follow the rules strictly."
                
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
            await update_state_fn(state)
        
        if emitter:
            # Send message with link
            await emitter.push("message", content=f"I have drafted your script (v{version}). Take a look here:", link={"label": f"v{version}_script.json", "target": "script"})
            # Request approval
            await emitter.push("approval_request", stage="script")
            
            # Pause and wait for response
            response_data = await emitter.wait_for_approval()
            approved = response_data.get("approved", False)
            reason = response_data.get("reason", "")
            
            if approved:
                await emitter.push("message", content="✅ Script approved!\n\nMoving on to Character Design... 🚧")
                state["approval_states"]["script_approved"] = True
                break
            else:
                summary_msg = f"🔁 Revision requested:\nQ: Does this script look good to you?\nA: No — '{reason}'\n\nLet me revise the script..."
                await emitter.push("message", content=summary_msg)
                # Append rejection feedback to messages silently so the LLM knows why it was rejected
                state["messages"].append(HumanMessage(content=f"I rejected the script version {version} with this feedback: {reason}. Please revise it."))
        else:
            # If no emitter (e.g. running outside API), just auto-approve for now
            approved = True

    return state

async def character_agent_node(state: FilmGraphState, config: RunnableConfig):
    emitter = config["configurable"].get("emitter")
    adapter = GeminiAdapter()

    approved = False
    version = state.get("character_version", 0)

    while not approved:
        if emitter:
            await emitter.push("status", content="Extracting characters..." if version == 0 else "Revising characters based on feedback...")
            await emitter.push("plan", steps=["Script Generation", "Character Design", "Voiceover", "Video Generation", "Editing"], current="Character Design")

        script_json_str = json.dumps(state.get("script_data", {}), indent=2)

        if version == 0:
            prompt = f"Here is the approved movie script:\n{script_json_str}\n\nExtract all the unique characters that appear in this script. For each character, provide a highly detailed visual description (face, clothing, build, aesthetic) that can be used directly as an image generation prompt."
        else:
            previous_characters_json = json.dumps(state.get("characters", []), indent=2)
            prompt = f"Here is the approved movie script:\n{script_json_str}\n\nHere is the previous character list you generated:\n{previous_characters_json}\n\nThe user rejected the previous character list with this feedback: {state['messages'][-1].content}\n\nPlease revise the character list according to this feedback. Modify the existing characters instead of starting from scratch."

        if emitter:
            await emitter.push("status", content="Designing characters...")

        script_data_dict = None
        max_retries = 3
        for attempt in range(max_retries):
            try:
                structured_data = await adapter.aget_structured_output(prompt, LLMCharacterData)
                script_data_dict = structured_data.model_dump()
                break
            except Exception as e:
                if attempt == max_retries - 1:
                    if emitter:
                        await emitter.push("error", content=f"Failed to generate characters: {str(e)}")
                    raise e
                prompt += f"\n\nError: {str(e)}. Try again."

        version += 1
        state["character_version"] = version
        state["characters"] = script_data_dict.get("characters", [])
        
        # Store in history
        history = state.get("character_history", [])
        history.append({
            "version": version,
            "data": copy.deepcopy(script_data_dict)
        })
        state["character_history"] = history
        
        # Save state manually since we will pause
        update_state_fn = config["configurable"].get("update_state")
        if update_state_fn:
            await update_state_fn(state)
        
        char_file_name = f"v{version}_characters.json"
        
        if emitter:
            await emitter.push("message", content=f"I have designed the characters (v{version}). Take a look here:", link={"label": char_file_name, "target": "characters_tab"})
            await emitter.push("approval_request", stage="characters")
            
            response_data = await emitter.wait_for_approval()
            approved = response_data.get("approved", False)
            reason = response_data.get("reason", "")
            
            if approved:
                await emitter.push("message", content="✅ Characters approved!\n\nImage generation coming soon! 🚧")
                state["approval_states"]["characters_approved"] = True
                break
            else:
                summary_msg = f"🔁 Revision requested:\nQ: Do these characters look good to you?\nA: No — '{reason}'\n\nLet me revise the characters..."
                await emitter.push("message", content=summary_msg)
                state["messages"].append(HumanMessage(content=f"I rejected the character list version {version} with this feedback: {reason}. Please revise it."))
        else:
            approved = True

    return state

# Build the Graph
workflow = StateGraph(FilmGraphState)

workflow.add_node("script_agent", script_agent_node)
workflow.add_node("character_agent", character_agent_node)

workflow.set_entry_point("script_agent")

workflow.add_edge("script_agent", "character_agent")
workflow.add_edge("character_agent", END)

# Compile the graph
app = workflow.compile()
