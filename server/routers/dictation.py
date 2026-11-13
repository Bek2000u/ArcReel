"""Same-origin audio relay for the chat's local GigaSTT service."""

import asyncio
import io
import json
import os
import wave
from contextlib import suppress
from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from websockets.asyncio.client import ClientConnection, connect
from websockets.exceptions import WebSocketException

from server.auth import get_current_user

router = APIRouter()
SAMPLE_RATE = 48_000
MAX_AUDIO_BYTES = SAMPLE_RATE * 2 * 90


def _service_url() -> str:
    return os.environ.get("ARCREEL_GIGASTT_URL", "").rstrip("/")


@router.get("/dictation/status", dependencies=[Depends(get_current_user)])
async def dictation_status() -> dict[str, bool]:
    return {"enabled": bool(_service_url())}


async def _send_audio(browser: WebSocket, upstream: ClientConnection, audio: bytearray) -> None:
    while True:
        message = await browser.receive()
        if message["type"] == "websocket.disconnect":
            raise WebSocketDisconnect(message.get("code", 1000))
        if message.get("text") == "stop":
            await upstream.send('{"type":"stop"}')
            return
        chunk = message.get("bytes")
        if not chunk or len(chunk) % 2 or len(chunk) > SAMPLE_RATE * 2:
            raise ValueError("Invalid PCM frame")
        if len(audio) + len(chunk) > MAX_AUDIO_BYTES:
            raise ValueError("Dictation too long")
        audio.extend(chunk)
        await upstream.send(chunk)


async def _send_partials(browser: WebSocket, upstream: ClientConnection) -> None:
    completed: list[str] = []
    async for raw in upstream:
        event = json.loads(raw)
        if event["type"] == "error":
            raise ValueError("GigaSTT stream failed")
        if event["type"] not in {"partial", "final"}:
            continue
        phrase = event.get("text", "").strip()
        if event["type"] == "final" and event.get("endpoint_reason") == "stop":
            return
        text = " ".join(filter(None, [*completed, phrase]))
        if phrase and event["type"] == "final":
            completed.append(phrase)
        await browser.send_json({"type": "partial", "text": text})


async def _stream_audio(browser: WebSocket, address: str, audio: bytearray) -> None:
    async with connect(address, open_timeout=4, close_timeout=1, proxy=None) as upstream:
        async with asyncio.timeout(5):
            ready = json.loads(await upstream.recv())
            if ready.get("type") != "ready":
                raise ValueError("GigaSTT is not ready")
            await upstream.send(json.dumps({"type": "configure", "sample_rate": SAMPLE_RATE}))
        await browser.send_json({"type": "ready"})
        sender = asyncio.create_task(_send_audio(browser, upstream, audio))
        reader = asyncio.create_task(_send_partials(browser, upstream))
        try:
            done, _ = await asyncio.wait({sender, reader}, timeout=105, return_when=asyncio.FIRST_COMPLETED)
            if sender not in done:
                if reader in done:
                    reader.result()
                raise TimeoutError("Dictation ended before stop")
            sender.result()
            async with asyncio.timeout(8):
                await reader
        finally:
            for task in (sender, reader):
                if not task.done():
                    task.cancel()
            await asyncio.gather(sender, reader, return_exceptions=True)


async def _final_transcript(base_url: str, audio: bytearray) -> str:
    if not audio:
        return ""
    wav = io.BytesIO()
    with wave.open(wav, "wb") as output:
        output.setparams((1, 2, SAMPLE_RATE, 0, "NONE", "not compressed"))
        output.writeframes(audio)
    async with httpx.AsyncClient(timeout=20, trust_env=False) as client:
        response = await client.post(
            f"{base_url}/v1/transcribe", files={"file": ("dictation.wav", wav.getvalue(), "audio/wav")}
        )
        response.raise_for_status()
        return response.json()["text"].strip()


@router.websocket("/dictation")
async def dictate(browser: WebSocket) -> None:
    origin = browser.headers.get("origin")
    if origin and urlsplit(origin).netloc.lower() != browser.headers.get("host", "").lower():
        await browser.close(code=1008)
        return
    await browser.accept()
    try:
        async with asyncio.timeout(5):
            auth = await browser.receive_json()
            token = auth.get("token") if isinstance(auth, dict) else None
            await get_current_user(token if isinstance(token, str) else None)
    except (HTTPException, KeyError, ValueError, TimeoutError):
        await browser.close(code=1008)
        return
    except WebSocketDisconnect:
        return

    base_url = _service_url()
    try:
        if not base_url:
            await browser.send_json({"type": "error", "code": "unavailable"})
            return
        audio = bytearray()
        address = base_url.replace("https://", "wss://", 1).replace("http://", "ws://", 1)
        await _stream_audio(browser, f"{address}/v1/ws", audio)
        transcript = await _final_transcript(base_url, audio)
        await browser.send_json({"type": "final", "text": transcript})
    except WebSocketDisconnect:
        return
    except (OSError, TimeoutError, ValueError, KeyError, WebSocketException, httpx.HTTPError):
        with suppress(WebSocketDisconnect):
            await browser.send_json({"type": "error", "code": "unavailable"})
    finally:
        if browser.application_state == WebSocketState.CONNECTED and browser.client_state == WebSocketState.CONNECTED:
            with suppress(WebSocketDisconnect):
                await browser.close()
