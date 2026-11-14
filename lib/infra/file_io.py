"""Filesystem operations shared by independent writers."""

import time
from collections.abc import Callable


def retry_windows_file_access[T](operation: Callable[[], T]) -> T:
    """Retry briefly when Windows refuses an open or replace during concurrent file access."""
    for delay in (0.01, 0.02, 0.05, 0.1, 0.2, 0.4):
        try:
            return operation()
        except PermissionError as exc:
            if getattr(exc, "winerror", None) not in {5, 32, 33}:
                raise
            time.sleep(delay)
    return operation()
