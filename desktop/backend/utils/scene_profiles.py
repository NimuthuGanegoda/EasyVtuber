"""Named scene/launcher profile persistence for EasyVtuber Desktop.

Dependency-free (stdlib only) so tests and headless scripts can manage launcher
profiles without importing wxPython or PyTorch.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
from typing import Any

_VALID_NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9 _.-]{0,47}$')
MAX_PROFILES = 32


def validate_profile_name(name: str) -> str:
    if not isinstance(name, str):
        raise ValueError('Profile name must be a string.')
    cleaned = name.strip()
    if not cleaned or not _VALID_NAME.fullmatch(cleaned):
        raise ValueError(
            'Profile name must be 1-48 characters using letters, numbers, spaces, _, -, or .'
        )
    return cleaned


def _atomic_write_json(path: str, payload: Any) -> None:
    parent = os.path.dirname(os.path.abspath(path))
    os.makedirs(parent, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(prefix='.profiles-', suffix='.tmp', dir=parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, path)
    finally:
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def load_profiles(path: str) -> dict[str, dict[str, Any]]:
    """Return all valid saved profiles, or an empty dict if missing/corrupt."""
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as handle:
            raw = json.load(handle)
    except (OSError, ValueError):
        return {}
    if not isinstance(raw, dict):
        return {}
    result: dict[str, dict[str, Any]] = {}
    for key, value in raw.items():
        if isinstance(key, str) and isinstance(value, dict):
            try:
                clean = validate_profile_name(key)
            except ValueError:
                continue
            result[clean] = dict(value)
            if len(result) >= MAX_PROFILES:
                break
    return result


def save_profile(path: str, name: str, settings: dict[str, Any]) -> dict[str, dict[str, Any]]:
    clean = validate_profile_name(name)
    if not isinstance(settings, dict):
        raise ValueError('Profile settings must be a JSON object.')
    profiles = load_profiles(path)
    if clean not in profiles and len(profiles) >= MAX_PROFILES:
        raise ValueError(f'Cannot store more than {MAX_PROFILES} profiles.')
    profiles[clean] = dict(settings)
    _atomic_write_json(path, profiles)
    return profiles


def delete_profile(path: str, name: str) -> dict[str, dict[str, Any]]:
    clean = validate_profile_name(name)
    profiles = load_profiles(path)
    if clean not in profiles:
        raise KeyError(f'Unknown profile: {clean}')
    del profiles[clean]
    _atomic_write_json(path, profiles)
    return profiles


def export_profile_json(name: str, settings: dict[str, Any]) -> str:
    clean = validate_profile_name(name)
    if not isinstance(settings, dict):
        raise ValueError('Profile settings must be a JSON object.')
    return json.dumps({'name': clean, 'settings': dict(settings)}, indent=2, sort_keys=True)


def import_profile_json(raw_json: str, allowed_keys: set[str] | None = None) -> tuple[str, dict[str, Any]]:
    try:
        parsed = json.loads(raw_json)
    except ValueError as exc:
        raise ValueError(f'Invalid profile JSON: {exc}') from exc
    if not isinstance(parsed, dict):
        raise ValueError('Profile JSON root must be an object.')
    clean = validate_profile_name(parsed.get('name', ''))
    settings = parsed.get('settings')
    if not isinstance(settings, dict):
        raise ValueError('Profile JSON must include a settings object.')
    if allowed_keys is not None:
        settings = {k: v for k, v in settings.items() if k in allowed_keys}
    return clean, dict(settings)
