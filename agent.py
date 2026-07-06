import asyncio
import json
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env")

from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents import VoiceAssistant
from livekit.plugins import openai, silero

# -----------------------------------------------------------
# The base personality and instructions for your AI tutor
# -----------------------------------------------------------
BASE_PROMPT = """You are CodeBot, a friendly and expert AI coding tutor.
Your rules:
- Never give away the full answer directly. Guide the student to find it themselves.
- Ask questions like "What do you think this line does?" to encourage thinking.
- Be encouraging. Say things like "Great try!" or "You're almost there!"
- Keep each voice response SHORT — 1 to 3 sentences max. This is a voice chat.
- When you see the student's code, reference it specifically. Say "I see on line 2..."
- If the student hasn't shared code yet, ask them to start typing in the editor."""


async def entrypoint(ctx: JobContext):
    # Connect to the LiveKit room (audio only — no video needed)
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Set up the chat context with our tutor personality
    chat_ctx = llm.ChatContext().append(
        role="system",
        text=BASE_PROMPT,
    )

    # -----------------------------------------------------------
    # Build the Voice Assistant pipeline (the CORRECT way)
    # -----------------------------------------------------------
    assistant = VoiceAssistant(
        vad=silero.VAD.load(),          # Silero detects when student stops speaking
        stt=openai.STT(),               # Whisper converts their speech to text
        llm=openai.LLM(model="gpt-4o-mini"),   # GPT generates the tutor response
        tts=openai.TTS(voice="alloy"),  # OpenAI speaks the response back
        chat_ctx=chat_ctx,
    )

    # -----------------------------------------------------------
    # Listen for code the student is typing in the editor
    # -----------------------------------------------------------
    @ctx.room.on("data_received")
    def on_code_received(data_packet):
        try:
            payload = json.loads(data_packet.data.decode("utf-8"))

            if payload.get("type") == "code":
                student_code = payload.get("content", "").strip()

                if not student_code:
                    return

                # Build a fresh system message that includes the current code
                updated_prompt = f"""{BASE_PROMPT}

--- STUDENT'S CURRENT CODE ---
{student_code}
------------------------------
The student is working on the code above. When they ask a question,
analyze this code and give specific, helpful feedback."""

                # Update the system message so the AI sees the latest code
                for msg in chat_ctx.messages:
                    if msg.role == "system":
                        msg.content = updated_prompt
                        break

                print(f"[CodeBot] Received code update ({len(student_code)} chars)")

        except Exception as e:
            print(f"[CodeBot] Error reading code from editor: {e}")

    # -----------------------------------------------------------
    # Start the session and greet the student
    # -----------------------------------------------------------
    assistant.start(ctx.room)

    # Small pause so the audio connection is ready before speaking
    await asyncio.sleep(1.5)

    await assistant.say(
        "Hello! I am CodeBot, your AI coding tutor. "
        "Start typing your code in the editor on the left and I will be able to see it. "
        "Then ask me anything — just speak!"
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
