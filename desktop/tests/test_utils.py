"""Unit tests for the dependency-free helpers under backend/utils."""

import argparse

import pytest

from backend.utils import output_layout
from backend.utils.mappers import beta_mapper, min_cutoff_mapper
from backend.utils.net import parse_host_port


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
