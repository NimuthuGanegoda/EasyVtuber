"""Unit tests for desktop launcher scene profiles."""

import pytest

from backend.utils.scene_profiles import (
    MAX_PROFILES,
    delete_profile,
    export_profile_json,
    import_profile_json,
    load_profiles,
    save_profile,
    validate_profile_name,
)


def test_profile_crud_roundtrip(tmp_path):
    store = str(tmp_path / 'profiles.json')
    assert load_profiles(store) == {}

    save_profile(store, 'Gaming 60FPS', {'frame_rate_limit': '60', 'preset': 'Low'})
    save_profile(store, 'Just Chatting', {'frame_rate_limit': '30', 'preset': 'Ultra'})
    loaded = load_profiles(store)
    assert set(loaded.keys()) == {'Gaming 60FPS', 'Just Chatting'}
    assert loaded['Gaming 60FPS']['frame_rate_limit'] == '60'

    remaining = delete_profile(store, 'Gaming 60FPS')
    assert list(remaining.keys()) == ['Just Chatting']


def test_corrupt_profile_file_returns_empty(tmp_path):
    store = tmp_path / 'profiles.json'
    store.write_text('{bad json', encoding='utf-8')
    assert load_profiles(str(store)) == {}

    store.write_text('["not", "a", "dict"]', encoding='utf-8')
    assert load_profiles(str(store)) == {}


@pytest.mark.parametrize('bad_name', ['', '   ', '../escape', 'bad/name', 'a' * 60])
def test_rejects_invalid_profile_names(bad_name):
    with pytest.raises(ValueError):
        validate_profile_name(bad_name)


def test_export_import_filters_allowed_keys():
    raw = export_profile_json('Stream A', {'preset': 'High', 'unknown_key': 123})
    name, settings = import_profile_json(raw, allowed_keys={'preset', 'output'})
    assert name == 'Stream A'
    assert settings == {'preset': 'High'}


def test_enforces_profile_cap(tmp_path):
    store = str(tmp_path / 'profiles.json')
    for i in range(MAX_PROFILES):
        save_profile(store, f'Profile {i}', {'preset': 'Low'})
    with pytest.raises(ValueError, match='more than'):
        save_profile(store, 'Overflow', {'preset': 'Low'})
