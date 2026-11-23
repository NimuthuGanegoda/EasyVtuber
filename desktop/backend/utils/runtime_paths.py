"""Runtime path and subprocess command helpers for source and frozen (.exe) runs.

Kept stdlib-only (no wx import) so unit tests and headless tools can verify
PyInstaller frozen packaging behavior cleanly on every platform.
"""

import os
from typing import List, Optional, Sequence


def get_bundle_root(frozen: bool, meipass: Optional[str], launcher_file: str) -> str:
    """Return the read-only root containing bundled scripts and assets."""
    if frozen and meipass:
        return os.path.normpath(meipass)
    return os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(launcher_file)), '..'))


def get_user_data_dir(frozen: bool, executable: str, bundle_root: str) -> str:
    """Return a persistent writable directory for launcher.json and profiles.json.

    In PyInstaller --onefile builds, sys._MEIPASS is an ephemeral temp folder
    wiped on exit — storing settings next to the executable keeps them across
    restarts.
    """
    if frozen and executable:
        return os.path.normpath(os.path.dirname(os.path.abspath(executable)))
    return os.path.normpath(bundle_root)


def normalize_python_executable(executable: str) -> str:
    """Switch pythonw -> python so stdout/stderr pipes work cleanly."""
    if 'pythonw' in executable.lower():
        return executable.replace('pythonw.exe', 'python.exe').replace('pythonw', 'python')
    return executable


def build_backend_command(
    frozen: bool,
    executable: str,
    bundle_root: str,
    cli_args: Sequence[str],
) -> List[str]:
    """Build the subprocess argv to start the VTuber backend engine.

    In frozen PyInstaller builds, `sys.executable` is the bundled launcher EXE
    itself, so we re-invoke it with `--run-backend` instead of passing a `.py`
    file (which would otherwise open a second copy of the launcher GUI).
    """
    if frozen:
        return [executable, '--run-backend', *cli_args]
    python_exe = normalize_python_executable(executable)
    main_script = os.path.join(bundle_root, 'main.py')
    return [python_exe, main_script, *cli_args]
