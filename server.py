import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from livekit.api import AccessToken, VideoGrants
from dotenv import load_dotenv

# Load .env from the project root (one folder above backend)
load_dotenv(dotenv_path="../.env")

app = FastAPI()

# -----------------------------------------------------------
# CORS — only allow requests from your actual frontend
# NEVER use "*" in production (security risk)
# -----------------------------------------------------------
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:5173",   # Local development
        "http://localhost:4173",   # Vite preview
    ],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/generate-token")
async def generate_token():
    """
    Generates a short-lived LiveKit access token for the student.
    The frontend fetches this and passes it to the LiveKitRoom component.
    """
    api_key    = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    livekit_url = os.getenv("LIVEKIT_URL")

    # Safety check — tell the developer if keys are missing
    if not all([api_key, api_secret, livekit_url]):
        return {"error": "Missing LIVEKIT_URL, LIVEKIT_API_KEY or LIVEKIT_API_SECRET in .env"}

    token = (
        AccessToken(api_key, api_secret)
        .with_identity("student")
        .with_name("Student")
        .with_grants(
            VideoGrants(
                room_join=True,
                room="classroom",
                can_publish=True,       # Student can speak
                can_subscribe=True,     # Student can hear tutor
            )
        )
    )

    return {
        "token": token.to_jwt(),
        "url": livekit_url,
    }


@app.get("/health")
async def health():
    """Simple health check — Render uses this to confirm the service is up."""
    return {"status": "ok"}
