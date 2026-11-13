from __future__ import annotations
import os
import re
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
        ctrl_name: str,
        scope: Optional[str] = None,
    ):
        # 1) attach payload (external)
        self.payload_shm = payload

        # 2) create/open lock file for synchronization.
        #
        # The lock name is scoped to the shared-memory segment it protects.
        # Segment names are unique per run, and every process in that run sees
        # the same name — so two independently launched instances of the app no
        # longer share lock files (previously they blocked each other, because
        # the name was global: one app's `pose_position_shm_ctrl` was the
        # other app's too).
        lock_scope = scope if scope is not None else getattr(payload, 'name', 'default')
        safe_scope = re.sub(r'[^A-Za-z0-9_.-]', '_', str(lock_scope))
        lock_dir = os.path.join(tempfile.gettempdir(), "easyvtuber_locks")
        os.makedirs(lock_dir, exist_ok=True)
        self.lock_file_path = os.path.join(lock_dir, f"{ctrl_name}__{safe_scope}.lock")
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
        sleep_s = 0.0005
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
                time.sleep(sleep_s)
                # Back off gradually instead of hammering the lock at a fixed
                # 1ms for however long the other side takes.
                sleep_s = min(sleep_s * 1.5, 0.005)

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
            raise TimeoutError(
                f"timed out acquiring shared-memory lock {os.path.basename(self.lock_file_path)} "
                f"after {timeout_ms}ms — another process is holding it. If this keeps happening "
                "after a crash, relaunch the app (locks are released automatically when the "
                "holding process exits)."
            )
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
