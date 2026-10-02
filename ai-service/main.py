from fastapi import FastAPI
from api.routes import workflow

app = FastAPI(title="CineForge AI Service")

app.include_router(workflow.router, prefix="/api")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}
