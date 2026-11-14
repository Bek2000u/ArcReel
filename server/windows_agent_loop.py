from __future__ import annotations

import asyncio
import os
import subprocess
from collections.abc import Callable
from pathlib import PureWindowsPath
from typing import Any


def create_windows_agent_loop() -> asyncio.AbstractEventLoop:
    """Keep subprocess support and suppress the Claude Agent SDK console on Windows."""

    class WindowsAgentLoop(asyncio.ProactorEventLoop):
        async def subprocess_exec(
            self,
            protocol_factory: Callable[[], asyncio.SubprocessProtocol],
            program: str | bytes,
            *args: str | bytes,
            **kwargs: Any,
        ) -> tuple[asyncio.SubprocessTransport, asyncio.SubprocessProtocol]:
            if PureWindowsPath(os.fsdecode(program)).name.casefold() == "claude.exe":
                kwargs["creationflags"] = kwargs.get("creationflags", 0) | subprocess.CREATE_NO_WINDOW
            return await super().subprocess_exec(protocol_factory, program, *args, **kwargs)

    return WindowsAgentLoop()
