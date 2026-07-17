from __future__ import annotations
import os
import sys
import tempfile
import time
from contextlib import contextmanager
from multiprocessing import shared_memory
from typing import Optional, Union

_IS_WINDOWS = sys.platform == 'win32'

if _IS_WINDOWS:
    import msvcrt
else:
    import fcntl


class SharedMemoryGuard:
    """
    Two-process exclusive access wrapper using File-based locking:
    - payload SharedMemory is provided externally
    - Uses file locking for cross-process synchronization
      (fcntl.flock on POSIX, msvcrt.locking on Windows)
    """

    def __init__(
        self,
        payload: shared_memory.SharedMemory,
        ctrl_name: str
    ):
        # 1) attach payload (external)
        self.payload_shm = payload

        # 2) create/open lock file for synchronization
        lock_dir = os.path.join(tempfile.gettempdir(), "easyvtuber_locks")
        os.makedirs(lock_dir, exist_ok=True)
        self.lock_file_path = os.path.join(lock_dir, f"{ctrl_name}.lock")
        # 'a+b' creates the file if missing without truncating it if another
        # process already created it (create is atomic at the OS level).
        open(self.lock_file_path, 'a+b').close()
        self._lock_file = open(self.lock_file_path, 'r+b')
        if _IS_WINDOWS:
            # msvcrt.locking requires at least one byte in the region it locks.
            self._lock_file.seek(0)
            self._lock_file.write(b'\0')
            self._lock_file.flush()

    # ---- payload view: zero-copy for numpy ----
    def payload_view(self) -> memoryview:
        return self.payload_shm.buf

    # ---- lock API ----
    def acquire(self, timeout_ms: Optional[int] = None) -> bool:
        """
        Acquire exclusive access using file locking.
        - timeout_ms=None => blocking wait
        """
        start_time = time.time()
        while True:
            try:
                if _IS_WINDOWS:
                    self._lock_file.seek(0)
                    msvcrt.locking(self._lock_file.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    fcntl.flock(self._lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return True
            except (IOError, OSError, BlockingIOError):
                if timeout_ms is not None:
                    elapsed = (time.time() - start_time) * 1000
                    if elapsed >= timeout_ms:
                        return False
                time.sleep(0.001)  # Minimal sleep to avoid CPU spinning

    def release(self) -> None:
        """Release the file lock."""
        if _IS_WINDOWS:
            self._lock_file.seek(0)
            msvcrt.locking(self._lock_file.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            fcntl.flock(self._lock_file, fcntl.LOCK_UN)

    @contextmanager
    def lock(self, timeout_ms: Optional[int] = None):
        if not self.acquire(timeout_ms=timeout_ms):
            raise TimeoutError("acquire() timeout")
        try:
            yield self
        finally:
            self.release()

    # ---- lifecycle ----
    def close(self) -> None:
        """Close handles and shared memory."""
        if self._lock_file:
            try:
                self.release()
                self._lock_file.close()
            except Exception:
                pass
            self._lock_file = None
        self.payload_shm.close()

    def unlink_control_if_owner(self) -> None:
        """Kept for API compatibility."""
        pass
