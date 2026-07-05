import threading
import os
from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "agent running"}

def start_agent():
    os.system("python agent.py start")

thread = threading.Thread(target=start_agent, daemon=True)
thread.start()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
