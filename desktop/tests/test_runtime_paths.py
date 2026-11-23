import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DESKTOP_ROOT = os.path.join(REPO_ROOT, "desktop")
if DESKTOP_ROOT not in sys.path:
    sys.path.append(DESKTOP_ROOT)

from backend.utils.runtime_paths import (
    build_backend_command,
    get_bundle_root,
    get_user_data_dir,
    normalize_python_executable,
)


def test_source_bundle_and_user_data_paths(tmp_path):
    fake_launcher = str(tmp_path / "gui" / "launcher2.py")
    root = get_bundle_root(False, None, fake_launcher)
    assert root == os.path.normpath(str(tmp_path))
    assert get_user_data_dir(False, "/usr/bin/python3", root) == root


def test_frozen_user_data_lives_next_to_exe_not_meipass(tmp_path):
    meipass = str(tmp_path / "temp_meipass")
    exe_dir = tmp_path / "install_dir"
    exe_path = str(exe_dir / "EasyVtuberClient.exe")

    assert get_bundle_root(True, meipass, "/ignored/launcher2.py") == os.path.normpath(meipass)
    assert get_user_data_dir(True, exe_path, meipass) == os.path.normpath(str(exe_dir))


def test_build_backend_command_frozen_uses_run_backend_flag():
    cmd = build_backend_command(
        frozen=True,
        executable="C:\\Apps\\EasyVtuberClient.exe",
        bundle_root="C:\\Temp\\_MEI123",
        cli_args=["--character", "Houshou_Marine", "--cam_input"],
    )
    assert cmd == [
        "C:\\Apps\\EasyVtuberClient.exe",
        "--run-backend",
        "--character",
        "Houshou_Marine",
        "--cam_input",
    ]


def test_build_backend_command_source_normalizes_pythonw(tmp_path):
    cmd = build_backend_command(
        frozen=False,
        executable="C:\\Python310\\pythonw.exe",
        bundle_root=str(tmp_path),
        cli_args=["--output_debug"],
    )
    assert cmd[0] == "C:\\Python310\\python.exe"
    assert cmd[1] == os.path.join(str(tmp_path), "main.py")
    assert cmd[2:] == ["--output_debug"]
    assert normalize_python_executable("/usr/bin/pythonw") == "/usr/bin/python"
