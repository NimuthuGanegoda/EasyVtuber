"""Shared description of the frame buffers passed from the inference process to
the output process.

Both sides used to compute this independently, and they disagreed: `main.py`
counted `--output_web` as a 3-channel (opaque) consumer while
`model_infer_client.py` did not. Running with `--output_web` alone therefore had
the producer writing 4-channel frames into a buffer the consumer addressed as
3-channel — a stride mismatch, i.e. silently scrambled output rather than a
clean error.

Keep both `np.ndarray` views derived from these helpers so they cannot drift
again.
"""

RET_CHANNELS_RGB = 3
RET_CHANNELS_RGBA = 4


def needs_opaque_output(args) -> bool:
    """True when a consumer only ever wants RGB (no alpha channel)."""
    return bool(args.output_virtual_cam or args.output_debug or args.output_web)


def ret_channel_count(args) -> int:
    return RET_CHANNELS_RGB if needs_opaque_output(args) else RET_CHANNELS_RGBA


def uses_bgr_frames(args) -> bool:
    """True when `post_process_ret` should emit 3-channel BGR frames.

    The debug window and the MJPEG web server both consume BGR (OpenCV's native
    order); the virtual camera consumes RGB. This must agree with
    `ret_channel_count()` — a 4-channel producer writing into a 3-channel buffer
    is exactly the bug this module exists to prevent.
    """
    return bool(args.output_debug or args.output_web)


def channel_width_scale(args) -> int:
    """Alpha-split output packs RGB and alpha side by side, doubling the width."""
    return 2 if args.alpha_split else 1


def frame_shape(args) -> tuple:
    """Shape of a single batch frame, as (height, width, channels)."""
    return (
        args.model_output_size,
        channel_width_scale(args) * args.model_output_size,
        ret_channel_count(args),
    )


def total_buffer_bytes(args) -> int:
    """Size of the whole shared-memory buffer (all interpolation slots)."""
    height, width, channels = frame_shape(args)
    return args.interpolation_scale * height * width * channels


def frame_bytes(args) -> int:
    """Size of a single frame slot inside the buffer."""
    height, width, channels = frame_shape(args)
    return height * width * channels
