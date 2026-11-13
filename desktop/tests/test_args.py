"""Tests for backend.managers.args.

Two regressions are covered here, both of which made the package untestable:

1. `args = parser.parse_args()` ran at import time, so importing any backend
   module under a foreign sys.argv owner (pytest -q, ipython, a linter) raised
   SystemExit and killed the process.
2. `--model_seperable` / `--model_half` / `--interpolation_half` were declared
   `store_true` with `default=True`, so there was no way to turn them off and the
   launcher's "Standard"/"Full precision" choices were silently ignored.
"""

import sys

import pytest

from backend.managers import args as args_module


def test_importing_args_does_not_parse_foreign_argv(monkeypatch):
    monkeypatch.setattr(sys, 'argv', ['pytest', '-q', '--something-weird'])
    # No SystemExit, no side effects: parsing is deferred.
    assert isinstance(args_module.args, args_module._LazyArgs)


def test_args_ignores_unknown_argv_entries(monkeypatch, capsys):
    monkeypatch.setattr(sys, 'argv', ['pytest', '-q', '-k', 'something'])
    parsed = args_module.get_args(refresh=True)
    assert parsed.frame_rate_limit == 30
    assert 'ignoring unrecognised arguments' in capsys.readouterr().err


def test_lazy_proxy_reads_derived_values(monkeypatch):
    monkeypatch.setattr(sys, 'argv', ['main.py'])
    parsed = args_module.get_args(refresh=True)
    assert parsed.max_ram_cache_len == pytest.approx(0.25)
    assert parsed.max_gpu_cache_len == pytest.approx(0.125)
    assert parsed.model_output_size == 512


@pytest.mark.parametrize(
    'flag, attribute, expected_on, expected_off',
    [
        ('--model_seperable', 'model_seperable', True, False),
        ('--model_half', 'model_half', True, False),
        ('--interpolation_half', 'interpolation_half', True, False),
    ],
)
def test_boolean_flags_can_be_switched_off(flag, attribute, expected_on, expected_off):
    on = args_module.get_args([flag])
    off = args_module.get_args(['--no-' + flag[2:]])
    assert getattr(on, attribute) is expected_on
    assert getattr(off, attribute) is expected_off


def test_flags_default_to_on():
    parsed = args_module.get_args([])
    assert parsed.model_seperable is True
    assert parsed.model_half is True


def test_no_output_flags_implies_debug_output():
    parsed = args_module.get_args([])
    assert parsed.output_debug is True


def test_output_web_suppresses_implicit_debug_output():
    parsed = args_module.get_args(['--output_web'])
    assert parsed.output_web is True
    assert parsed.output_debug is False


def test_spout2_disables_alpha_split():
    parsed = args_module.get_args(['--output_spout2', '--alpha_split'])
    assert parsed.alpha_split is False


def test_super_resolution_raises_output_size():
    parsed = args_module.get_args(['--sr_a4k'])
    assert parsed.use_sr is True
    assert parsed.model_output_size == 1024


def test_no_input_flags_implies_debug_input():
    parsed = args_module.get_args([])
    assert parsed.debug_input is True


def test_convert_to_byte_units():
    assert args_module.convert_to_byte('256mb') == 256 * 1024 ** 2
    assert args_module.convert_to_byte('1gb') == 1024 ** 3
    with pytest.raises(ValueError):
        args_module.convert_to_byte('not-a-size')
