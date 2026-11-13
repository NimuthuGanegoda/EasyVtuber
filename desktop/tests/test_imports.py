"""Guards the dependency boundaries the runtime depends on.

The pose-parameter table used to live in `mode_20.py`, which imports torch, so
the ONNX inference path silently required a multi-gigabyte PyTorch install just
to read a list of index constants. These tests fail if that coupling comes back.
"""

import sys

import numpy as np


def test_ifacialmocap_converter_imports_without_torch():
    import tha2.poser.modes.mode_20_wx as mode_20_wx

    converter = mode_20_wx.IFacialMocapPoseConverter20()
    # 45 floats is the pose buffer layout used by every input client.
    assert converter.pose_size == 45
    assert 'torch' not in sys.modules


def test_pose_simplify_runs_without_torch():
    from backend.utils.pose_simplify import pose_simplify

    result = pose_simplify(np.zeros(45, dtype=np.float32))
    assert result.shape == (1, 45)
    assert 'torch' not in sys.modules


def test_model_downloader_imports_headlessly():
    # Importing `wx` at module scope used to make this fail without a display.
    from backend.managers import model_downloader

    assert model_downloader.get_models_dir().endswith('models')


def test_launcher_helpers_are_importable_without_wx():
    # Mappers used to live in gui/launcher2.py, which imports wx at module scope.
    from backend.utils.mappers import beta_mapper, min_cutoff_mapper

    assert min_cutoff_mapper(100) == 100.0
    assert beta_mapper(100) == 1.0
