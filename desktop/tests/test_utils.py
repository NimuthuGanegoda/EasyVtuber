"""Unit tests for the dependency-free helpers under backend/utils."""

import argparse

import pytest

from backend.utils import output_layout
from backend.utils.mappers import beta_mapper, min_cutoff_mapper
from backend.utils.net import parse_host_port, resolve_udp_bind_host
from backend.utils.pose import Landmark, get_iris_center_point, get_pose


class TestParseHostPort:
    def test_host_and_port(self):
        assert parse_host_port('127.0.0.1:39539') == ('127.0.0.1', 39539)

    def test_host_only_uses_default_port(self):
        assert parse_host_port('127.0.0.1') == ('127.0.0.1', 39539)

    def test_ipv6_with_brackets(self):
        assert parse_host_port('[::1]:40000') == ('::1', 40000)

    def test_bare_ipv6_keeps_default_port(self):
        # Regression: `value.split(':')` produced host '' and port '' here.
        assert parse_host_port('::1') == ('::1', 39539)

    def test_any_interface(self):
        assert parse_host_port('0.0.0.0:39539') == ('0.0.0.0', 39539)

    @pytest.mark.parametrize(
        'value',
        ['', '   ', '127.0.0.1:', '127.0.0.1:abc', '127.0.0.1:0', '127.0.0.1:70000', ':39539', '[::1'],
    )
    def test_rejects_malformed_input(self, value):
        with pytest.raises(ValueError):
            parse_host_port(value)


class TestMappers:
    @pytest.mark.parametrize('slider', [0, 1, 25, 50, 80, 100])
    def test_min_cutoff_round_trips(self, slider):
        assert min_cutoff_mapper(min_cutoff_mapper(slider), revert=True) == pytest.approx(
            slider, abs=1
        )

    @pytest.mark.parametrize('slider', [0, 1, 25, 50, 80, 100])
    def test_beta_round_trips(self, slider):
        assert beta_mapper(beta_mapper(slider), revert=True) == pytest.approx(slider, abs=1)

    def test_mappers_are_monotonic(self):
        values = [min_cutoff_mapper(i) for i in range(101)]
        assert values == sorted(values)


class TestOutputLayout:
    def make_args(self, **overrides):
        base = dict(
            output_virtual_cam=False,
            output_debug=False,
            output_web=False,
            alpha_split=False,
            model_output_size=512,
            interpolation_scale=1,
        )
        base.update(overrides)
        return argparse.Namespace(**base)

    def test_alpha_output_uses_four_channels(self):
        args = self.make_args()
        assert output_layout.ret_channel_count(args) == 4
        assert output_layout.frame_shape(args) == (512, 512, 4)

    @pytest.mark.parametrize('flag', ['output_virtual_cam', 'output_debug', 'output_web'])
    def test_every_opaque_consumer_uses_three_channels(self, flag):
        # Regression: main.py counted --output_web as 3-channel while
        # model_infer_client.py did not, so `--output_web` alone produced a
        # producer/consumer stride mismatch.
        args = self.make_args(**{flag: True})
        assert output_layout.ret_channel_count(args) == 3

    def test_alpha_split_doubles_width(self):
        args = self.make_args(alpha_split=True, output_debug=True)
        assert output_layout.frame_shape(args) == (512, 1024, 3)

    def test_buffer_size_accounts_for_every_interpolated_frame(self):
        args = self.make_args(interpolation_scale=2, output_debug=True)
        assert output_layout.total_buffer_bytes(args) == 2 * 512 * 512 * 3
        assert output_layout.frame_bytes(args) == 512 * 512 * 3

    def test_super_resolution_output_size(self):
        args = self.make_args(model_output_size=1024, output_web=True)
        assert output_layout.frame_shape(args) == (1024, 1024, 3)


class TestOutputLayoutAgreement:
    """The producer's frame format and the consumer's buffer shape must agree.

    Regression guard: `--output_web` alone used to get a 3-channel buffer but a
    4-channel RGBA frame from post_process_ret.
    """

    @pytest.mark.parametrize('virtual_cam', [False, True])
    @pytest.mark.parametrize('debug', [False, True])
    @pytest.mark.parametrize('web', [False, True])
    def test_bgr_decision_matches_channel_count(self, virtual_cam, debug, web):
        args = argparse.Namespace(
            output_virtual_cam=virtual_cam,
            output_debug=debug,
            output_web=web,
            alpha_split=False,
            model_output_size=512,
            interpolation_scale=1,
        )
        opaque = output_layout.needs_opaque_output(args)
        bgr = output_layout.uses_bgr_frames(args)
        # BGR (3-channel) is a subset of the opaque formats, never a 4-channel one.
        if bgr:
            assert opaque, 'BGR frames require a 3-channel buffer'
        assert output_layout.ret_channel_count(args) == (3 if opaque else 4)


class TestResolveUdpBindHost:
    @pytest.mark.parametrize('peer, expected', [
        ('127.0.0.1', '127.0.0.1'),
        ('localhost', '127.0.0.1'),
        ('', '127.0.0.1'),
        ('::1', '::1'),
    ])
    def test_loopback_peers_stay_on_loopback(self, peer, expected):
        assert resolve_udp_bind_host(peer, 49983) == expected


class TestPoseExtraction:
    @staticmethod
    def _make_landmarks(count: int, collapsed: bool = False):
        if collapsed:
            return [Landmark(0.5, 0.5, 0.0) for _ in range(count)]
        points = []
        for i in range(count):
            col = i % 20
            row = (i // 20) % 20
            points.append(Landmark(0.25 + col * 0.025, 0.2 + row * 0.03, -0.01 + (i % 7) * 0.002))
        return points

    @pytest.mark.parametrize('count', [468, 478])
    def test_get_pose_works_with_and_without_iris_landmarks(self, count):
        pose = get_pose(self._make_landmarks(count))
        assert len(pose) == 8
        assert all(float('-inf') < float(v) < float('inf') for v in pose)

    def test_get_pose_handles_collapsed_landmarks_without_zero_division(self):
        pose = get_pose(self._make_landmarks(478, collapsed=True))
        assert len(pose) == 8
        assert all(float('-inf') < float(v) < float('inf') for v in pose)

    def test_get_iris_center_point_rejects_missing_or_invalid_side(self):
        landmarks = self._make_landmarks(468)
        with pytest.raises(ValueError):
            get_iris_center_point(landmarks, None)
        with pytest.raises(ValueError):
            get_iris_center_point(landmarks, 'center')


class TestPreprocess:
    @staticmethod
    def _import_preprocess(monkeypatch):
        """Import backend.utils.preprocess even in dev envs without Pillow."""
        import importlib.util
        import sys
        import types

        if importlib.util.find_spec('PIL') is not None:
            from backend.utils import preprocess
            return preprocess, False

        fake_pil = types.ModuleType('PIL')
        fake_image_mod = types.ModuleType('PIL.Image')
        fake_image_mod.LANCZOS = 1
        fake_image_mod.merge = lambda mode, channels: (mode, channels)
        fake_pil.Image = fake_image_mod
        monkeypatch.setitem(sys.modules, 'PIL', fake_pil)
        monkeypatch.setitem(sys.modules, 'PIL.Image', fake_image_mod)
        from backend.utils import preprocess
        monkeypatch.setattr(preprocess.Image, 'merge', fake_image_mod.merge)
        return preprocess, True

    def test_apply_color_curves_applies_all_matching_channels(self, monkeypatch):
        preprocess, stubbed = self._import_preprocess(monkeypatch)
        if not stubbed:
            from PIL import Image
            img = Image.new('RGBA', (2, 2), (100, 100, 100, 128))
            out = preprocess.apply_color_curves(
                img, {'rgb': [(0, 0), (255, 255)], 'a': [(0, 0), (128, 255), (255, 255)]}
            )
            assert out.getpixel((0, 0))[3] == 255
            return

        class _FakeChannel:
            def __init__(self, value):
                self.value = value

            def point(self, lut):
                return _FakeChannel(lut[self.value])

        class _FakeImage:
            mode = 'RGBA'

            def __init__(self, values):
                self._channels = [_FakeChannel(v) for v in values]

            def split(self):
                return list(self._channels)

        out_mode, out_channels = preprocess.apply_color_curves(
            _FakeImage([100, 100, 100, 128]),
            {'rgb': [(0, 0), (255, 255)], 'a': [(0, 0), (128, 255), (255, 255)]},
        )
        assert out_mode == 'RGBA'
        assert [c.value for c in out_channels] == [100, 100, 100, 255]

    def test_apply_color_curves_returns_image_when_empty(self, monkeypatch):
        preprocess, stubbed = self._import_preprocess(monkeypatch)
        if not stubbed:
            from PIL import Image
            img = Image.new('RGBA', (2, 2), (10, 20, 30, 40))
            out = preprocess.apply_color_curves(img, {})
            assert out.getpixel((0, 0)) == (10, 20, 30, 40)
            return

        class _FakeImage:
            mode = 'RGBA'

            def split(self):
                return [10, 20, 30, 40]

        out_mode, out_channels = preprocess.apply_color_curves(_FakeImage(), {})
        assert out_mode == 'RGBA'
        assert out_channels == [10, 20, 30, 40]
