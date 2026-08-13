import asyncio
import json
import os
from dotenv import load_dotenv

load_dotenv()

from livekit.agents import AutoSubscribe, JobContext, JobProcess, WorkerOptions, cli, llm
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import openai, silero

BASE_PROMPT = """You are CodeBot, a friendly AI coding tutor.
Never give direct answers. Guide the student to find them.
Keep responses SHORT - 1 to 3 sentences max."""

def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load(force_cpu=True)

async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    chat_ctx = llm.ChatContext().append(
        role="system",
        text=BASE_PROMPT,
    )

    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GROQ_BASE_URL = "https://api.groq.com/openai/v1"

    assistant = VoiceAssistant(
        vad=ctx.proc.userdata["vad"],
        stt=openai.STT(
            model="whisper-large-v3",
            base_url=GROQ_BASE_URL,
            api_key=GROQ_API_KEY,
        ),
        llm=openai.LLM(
            model="llama-3.3-70b-versatile",
            base_url=GROQ_BASE_URL,
            api_key=GROQ_API_KEY,
        ),
        tts=openai.TTS(
            model="playai-tts",
            voice="Fritz-PlayAI",
            base_url=GROQ_BASE_URL,
            api_key=GROQ_API_KEY,
        ),
        chat_ctx=chat_ctx,
    )

    assistant.start(ctx.room)
    await assistant.say("Hello! I am CodeBot. Start typing your code and ask me anything!")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        prewarm_fnc=prewarm,
        initialize_process_timeout=120.0,
    ))
