"""Create filesystem links for tests that need real symlinks."""

from pathlib import Path

import pytest


def make_symlink(link: Path, target: str | Path, *, target_is_directory: bool = False) -> None:
    try:
        link.symlink_to(target, target_is_directory=target_is_directory)
    except OSError as exc:
        if getattr(exc, "winerror", None) == 1314:
            pytest.skip("Windows did not grant permission to create a symbolic link")
        raise
