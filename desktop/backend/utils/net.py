"""Helpers for the `host:port` strings accepted on the command line.

Naive `value.split(':')` broke IPv6 addresses (`::1:39539` produced a host of
`''` and a port of `''`) and silently accepted nonsense. The launcher's
preflight check and the VMC client now share one implementation, so validation
and behaviour cannot disagree.
"""

import socket

DEFAULT_VMC_PORT = 39539
DEFAULT_OSF_PORT = 11573
DEFAULT_IFM_PORT = 49983


def resolve_udp_bind_host(peer_host: str, port: int) -> str:
    """Choose the local interface IP to receive UDP replies from *peer_host*.

    Loopback peers bind loopback directly; remote LAN peers probe the routing
    table with a connected UDP socket (no packet sent) instead of binding ''
    on every network interface.
    """
    host = (peer_host or '').strip().lower()
    if host in ('', 'localhost', '127.0.0.1'):
        return '127.0.0.1'
    if host == '::1':
        return '::1'
    family = socket.AF_INET6 if ':' in host else socket.AF_INET
    try:
        with socket.socket(family, socket.SOCK_DGRAM) as probe:
            probe.connect((peer_host, port))
            local_ip = probe.getsockname()[0]
            if local_ip and local_ip not in ('0.0.0.0', '::'):
                return local_ip
    except OSError:
        pass
    return '::1' if family == socket.AF_INET6 else '127.0.0.1'


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
