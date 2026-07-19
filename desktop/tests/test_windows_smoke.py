import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DESKTOP_ROOT = os.path.join(REPO_ROOT, "desktop")
if DESKTOP_ROOT not in sys.path:
    sys.path.append(DESKTOP_ROOT)

from backend.managers import model_downloader


def _touch(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"ok")


def test_requirements_entrypoints():
    req_txt = os.path.join(REPO_ROOT, "desktop", "requirements", "requirements.txt")
    with open(req_txt, "r", encoding="utf-8") as f:
        content = f.read()
    assert "-r requirements-core.txt" in content


def test_validate_selected_model_v3(monkeypatch, tmp_path):
    monkeypatch.setattr(model_downloader, "get_models_dir", lambda: str(tmp_path))
    base = tmp_path / "tha3" / "seperable" / "fp16"
    for name in model_downloader._THA3_COMPONENTS:
        _touch(str(base / name))

    ok, _, missing = model_downloader.validate_selected_model("seperable_half")
    assert ok
    assert missing == []


def test_validate_selected_model_student_tensorrt(monkeypatch, tmp_path):
    monkeypatch.setattr(model_downloader, "get_models_dir", lambda: str(tmp_path))
    model_dir = tmp_path / "custom_tha4_models" / "demo_model"
    _touch(str(model_dir / "face_morpher.trt"))
    _touch(str(model_dir / "body_morpher.trt"))
    _touch(str(model_dir / "character.png"))

    ok, _, missing = model_downloader.validate_selected_model(
        model_select="tha4_student_demo_model",
        model_name="demo_model",
        use_tensorrt=True,
    )
    assert ok
    assert missing == []
