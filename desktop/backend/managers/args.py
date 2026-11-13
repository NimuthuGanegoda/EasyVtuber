import argparse
import re
import sys
from typing import Optional


def convert_to_byte(size):
    result = re.search(r'(\d+\.?\d*)(b|kb|mb|gb|tb)', size.lower())
    if (result and result.groups()):
        unit = result.groups()[1]
        amount = float(result.groups()[0])
        index = ['b', 'kb', 'mb', 'gb', 'tb'].index(unit)
        return amount * pow(1024, index)
    raise ValueError("Invalid size provided, value is " + size)


def build_parser() -> argparse.ArgumentParser:
    """Build the CLI parser without touching sys.argv.

    Kept separate from parsing so tests (and any tool that imports this package)
    can build/inspect the parser without the side effects of parsing.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument('--character', type=str, default='Houshou_Marine')

    parser.add_argument('--debug_input', action='store_true')
    parser.add_argument('--cam_input', action='store_true')
    parser.add_argument('--mouse_input', type=str)
    parser.add_argument('--ifm_input', type=str)
    parser.add_argument('--osf_input', type=str)
    parser.add_argument('--vmc_input', type=str,
                        help='Receive tracking data over the VMC protocol (OSC/UDP). '
                             'Format host:port, e.g. 127.0.0.1:39539 — the host is the '
                             'local interface to bind; use 0.0.0.0 to accept VMC senders '
                             'from other devices on your network. IPv6 addresses must be '
                             'bracketed, e.g. [::1]:39539.')

    parser.add_argument('--mouse_audio_input', action='store_true')
    parser.add_argument('--audio_sensitivity', type=float, default=0.02)
    parser.add_argument('--audio_threshold', type=float, default=10.0)
    parser.add_argument('--blink_interval', type=float, default=5.0)
    parser.add_argument('--breath_cycle', type=float, default=float('inf'))

    parser.add_argument('--output_virtual_cam', action='store_true')
    parser.add_argument('--output_spout2', action='store_true')
    parser.add_argument('--output_debug', action='store_true')
    parser.add_argument('--output_web', action='store_true', help='Output as MJPEG stream over HTTP')

    parser.add_argument('--alpha_split', action='store_true')
    parser.add_argument('--bongo', action='store_true')
    parser.add_argument('--extend_movement', action='store_true')

    parser.add_argument('--filter_min_cutoff', type=float, default=10.0)
    parser.add_argument('--filter_beta', type=float, default=0.3)

    parser.add_argument('--simplify', type=int, default=1)

    parser.add_argument('--use_tensorrt', action='store_true')
    parser.add_argument('--model_version', type=str, default='v4_student')
    parser.add_argument('--model_name', type=str, default='')
    # BooleanOptionAction (not store_true) so the ON value can actually be
    # switched off: `store_true, default=True` made these flags un-turn-off-able,
    # which silently ignored the launcher's "Standard"/"Full precision" choices.
    parser.add_argument('--model_seperable', action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument('--model_half', action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument('--gpu_cache', type=str, default='128mb')
    parser.add_argument('--eyebrow', action='store_true')

    parser.add_argument('--use_interpolation', action='store_true', default=False)
    parser.add_argument('--interpolation_scale', type=int, default=1)
    parser.add_argument('--interpolation_half', action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument('--mark_interpolated', action='store_true',
                        help='在插值帧左上角打红点便于确认补帧输出')

    parser.add_argument('--use_sr', action='store_true', default=False)
    parser.add_argument('--sr_x4', action='store_true')
    parser.add_argument('--sr_half', action='store_true')
    parser.add_argument('--sr_a4k', action='store_true')

    parser.add_argument('--cache', type=str, default='256mb')

    parser.add_argument('--frame_rate_limit', type=int, default=30)

    parser.add_argument('--alpha_clean', action='store_true')

    return parser


def derive_args(args: argparse.Namespace) -> argparse.Namespace:
    """Apply the derived values (byte sizes, implied modes, output size)."""
    if args.cache is not None:
        args.max_ram_cache_len = convert_to_byte(args.cache) / pow(1024, 3)  # In gigabytes
    else:
        args.max_ram_cache_len = 0
    if args.gpu_cache is not None:
        args.max_gpu_cache_len = convert_to_byte(args.gpu_cache) / pow(1024, 3)  # In gigabytes
    else:
        args.max_gpu_cache_len = 0

    if args.simplify == 0:
        args.max_ram_cache_len = 0  # Disable cacher if simplify is Off

    if not args.output_virtual_cam and not args.output_spout2 and not args.output_web:
        args.output_debug = True  # Default to debug output

    if args.output_spout2:
        args.alpha_split = False  # Disable alpha split for spout2 output

    if not args.cam_input and args.mouse_input is None \
        and args.ifm_input is None and args.osf_input is None \
        and args.vmc_input is None:
        args.debug_input = True  # Default to debug input

    if args.sr_a4k:
        args.use_sr = True

    args.model_output_size = 1024 if args.use_sr else 512
    return args


_args: Optional[argparse.Namespace] = None


def get_args(argv=None, *, refresh: bool = False) -> argparse.Namespace:
    """Parse (once) and return the process-wide arguments.

    `parse_known_args` rather than `parse_args`: this module is imported by every
    backend module, so under a foreign owner of sys.argv (pytest, ipython, a
    linter) `parse_args` used to raise SystemExit and kill the importing process.

    Pass `refresh=True` (or a fresh `argv`) in tests to re-parse.
    """
    global _args
    if _args is not None and not refresh and argv is None:
        return _args
    parser = build_parser()
    namespace, unknown = parser.parse_known_args(argv)
    if unknown:
        print(
            '[args] ignoring unrecognised arguments: ' + ' '.join(unknown),
            file=sys.stderr,
        )
    parsed = derive_args(namespace)
    if argv is None:
        _args = parsed
    return parsed


class _LazyArgs:
    """Attribute proxy so existing `from .args import args` imports keep working
    while parsing is deferred until the first attribute access."""

    __slots__ = ()

    def __getattr__(self, name):
        return getattr(get_args(), name)

    def __setattr__(self, name, value):
        setattr(get_args(), name, value)

    def __repr__(self):
        return repr(get_args())


args = _LazyArgs()
