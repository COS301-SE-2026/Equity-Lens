from fastapi import FastAPI

app = FastAPI(
    title="EquityLens API",
    description="Investment platform API",
    version="0.1.0"
)

@app.get("/")
def root():
    return {"message": "API is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}