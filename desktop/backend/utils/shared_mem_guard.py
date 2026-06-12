from __future__ import annotations
import os
import time
import fcntl
from contextlib import contextmanager
from multiprocessing import shared_memory
from typing import Optional, Union

class SharedMemoryGuard:
    """
    Two-process exclusive access wrapper using File-based locking (Linux/Unix):
    - payload SharedMemory is provided externally
    - Uses file locking for cross-process synchronization
    """

    def __init__(
        self,
        payload: shared_memory.SharedMemory,
        ctrl_name: str
    ):
        # 1) attach payload (external)
        self.payload_shm = payload

        # 2) create/open lock file for synchronization
        lock_dir = "/tmp/easyvtuber_locks"
        os.makedirs(lock_dir, exist_ok=True)
        self.lock_file_path = os.path.join(lock_dir, f"{ctrl_name}.lock")
        self._lock_file = open(self.lock_file_path, 'w')

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
                # Attempt to acquire an exclusive lock
                fcntl.flock(self._lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return True
            except (IOError, BlockingIOError):
                if timeout_ms is not None:
                    elapsed = (time.time() - start_time) * 1000
                    if elapsed >= timeout_ms:
                        return False
                time.sleep(0.001)  # Minimal sleep to avoid CPU spinning

    def release(self) -> None:
        """Release the file lock."""
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
            except:
                pass
            self._lock_file = None
        self.payload_shm.close()

    def unlink_control_if_owner(self) -> None:
        """Kept for API compatibility."""
        pass
