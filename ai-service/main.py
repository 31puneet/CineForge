from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from api.routes import workflow

app = FastAPI(title="CineForge AI Service")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print("VALIDATION ERROR:", exc.errors())
    print("BODY:", exc.body)
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

app.include_router(workflow.router, prefix="/api")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}
