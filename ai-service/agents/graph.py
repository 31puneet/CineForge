from langgraph.graph import StateGraph, END
from schemas.state import FilmGraphState
from langchain_core.messages import AIMessage

# Dummy Node functions
def script_agent_node(state: FilmGraphState):
    print("Executing Script Agent...")
    return {"current_stage": "script", "messages": [AIMessage(content="Generated script structure (Dummy)")]}

def character_agent_node(state: FilmGraphState):
    print("Executing Character Agent...")
    return {"current_stage": "character", "messages": [AIMessage(content="Generated characters (Dummy)")]}

def voiceover_agent_node(state: FilmGraphState):
    print("Executing Voiceover Agent...")
    return {"current_stage": "voiceover", "messages": [AIMessage(content="Generated voiceovers (Dummy)")]}

def video_agent_node(state: FilmGraphState):
    print("Executing Video Agent...")
    return {"current_stage": "video", "messages": [AIMessage(content="Generated video jobs (Dummy)")]}

def editor_agent_node(state: FilmGraphState):
    print("Executing Editor Agent...")
    return {"current_stage": "editor", "messages": [AIMessage(content="Assembled final video (Dummy)")]}

# Build the Graph
workflow = StateGraph(FilmGraphState)

workflow.add_node("script_agent", script_agent_node)
workflow.add_node("character_agent", character_agent_node)
workflow.add_node("voiceover_agent", voiceover_agent_node)
workflow.add_node("video_agent", video_agent_node)
workflow.add_node("editor_agent", editor_agent_node)

# Routing Logic based on approval_states and current_stage
def route_next_stage(state: FilmGraphState):
    stage = state.get("current_stage", "")
    approvals = state.get("approval_states", {})
    
    # In a real app, if script is not approved, we route to END to pause.
    if stage == "script" and not approvals.get("script_approved"):
        return END
        
    if stage == "character" and not approvals.get("characters_approved"):
        return END

    # For testing the graph sequence linearly:
    if stage == "script":
        return "character_agent"
    elif stage == "character":
        return "voiceover_agent"
    elif stage == "voiceover":
        return "video_agent"
    elif stage == "video":
        return "editor_agent"
    elif stage == "editor":
        return END
        
    return "script_agent" # default start

workflow.set_entry_point("script_agent")

workflow.add_conditional_edges(
    "script_agent",
    route_next_stage,
)
workflow.add_conditional_edges(
    "character_agent",
    route_next_stage,
)
workflow.add_conditional_edges(
    "voiceover_agent",
    route_next_stage,
)
workflow.add_conditional_edges(
    "video_agent",
    route_next_stage,
)
workflow.add_conditional_edges(
    "editor_agent",
    route_next_stage,
)

# Compile the graph
app = workflow.compile()
