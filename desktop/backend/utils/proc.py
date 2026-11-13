"""Cross-platform teardown for the launcher's child process."""

import subprocess
import sys

_CREATE_NO_WINDOW = 0x08000000


def terminate_process(proc, timeout: float = 5.0) -> None:
    """Ask the child to exit, then force-kill its tree as a last resort.

    The launchers used to call `taskkill /F /PID <pid> /T` immediately, which
    force-kills *by PID* — if the child had already exited and Windows reused
    that PID, an unrelated process tree died instead. Now the graceful path is
    tried first (the app handles SIGTERM/CTRL_BREAK and closes its shared
    memory), and the tree kill is only the fallback.

    A tree kill is still required as the fallback because the app spawns its own
    children (input + inference); a plain `terminate()` leaves those behind and
    the next launch fails with "address already in use" on the shared memory.
    """
    if proc is None:
        return
    try:
        if proc.poll() is not None:
            return
    except Exception:
        pass

    try:
        proc.terminate()
    except Exception:
        pass
    try:
        proc.wait(timeout=timeout)
        return
    except Exception:
        pass

    try:
        if sys.platform == 'win32':
            subprocess.run(
                ['taskkill', '/F', '/PID', str(proc.pid), '/T'],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=_CREATE_NO_WINDOW,
            )
        else:
            proc.kill()
    except Exception:
        pass

    try:
        proc.wait(timeout=timeout)
    except Exception:
        pass
