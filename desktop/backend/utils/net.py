"""Helpers for the `host:port` strings accepted on the command line.

Naive `value.split(':')` broke IPv6 addresses (`::1:39539` produced a host of
`''` and a port of `''`) and silently accepted nonsense. The launcher's
preflight check and the VMC client now share one implementation, so validation
and behaviour cannot disagree.
"""

DEFAULT_VMC_PORT = 39539


def parse_host_port(value: str, default_port: int = DEFAULT_VMC_PORT) -> tuple:
    """Parse 'host:port', '[::1]:39539' or a bare host into (host, port).

    Raises ValueError with an actionable message on malformed input.
    """
    text = (value or '').strip()
    if not text:
        raise ValueError('expected host:port (example: 127.0.0.1:39539)')

    # Bracketed IPv6, optionally followed by :port
    if text.startswith('['):
        host, sep, rest = text[1:].partition(']')
        if not sep:
            raise ValueError(f'missing closing "]" in IPv6 address: {value!r}')
        if not rest:
            return host, default_port
        if not rest.startswith(':'):
            raise ValueError(f'unexpected characters after IPv6 address: {value!r}')
        return host, _parse_port(rest[1:], value)

    # Bare IPv6 (more than one colon) cannot carry a port without brackets.
    if text.count(':') > 1:
        return text, default_port

    host, sep, port_text = text.rpartition(':')
    if not sep:
        return text, default_port
    if not host:
        raise ValueError(f'missing host in {value!r} (expected host:port)')
    return host, _parse_port(port_text, value)


def _parse_port(text: str, original: str) -> int:
    try:
        port = int(text)
    except (TypeError, ValueError):
        raise ValueError(f'port must be a number, got {text!r} in {original!r}') from None
    if not 1 <= port <= 65535:
        raise ValueError(f'port must be between 1 and 65535, got {port} in {original!r}')
    return port
