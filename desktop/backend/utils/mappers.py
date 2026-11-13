"""Slider <-> value mappings shared by the GUI launchers.

These lived inside `gui/launcher2.py`, which imports `wx` at module scope — so
they could not be unit-tested without a GUI toolkit and a display. They are pure
math and belong somewhere importable.
"""


def min_cutoff_mapper(value, revert=False):
    """
    Non-linear mapping function: 0-100 integer <-> 0-100 float
    Uses square function so numbers are denser closer to 0
    """
    if revert:
        # Float -> Int: Use square root inverse mapping
        return int((value / 100.0) ** 0.5 * 100)
    # Int -> Float: Use square mapping
    return (value / 100.0) ** 2 * 100.0


def beta_mapper(value, revert=False):
    """
    Non-linear mapping function: 0-100 integer <-> 0-1 float
    Uses square function so numbers are denser closer to 0
    """
    if revert:
        # Float -> Int: Use square root mapping
        return int((value**0.5) * 100)
    # Int -> Float: Use square mapping
    return (value / 100.0) ** 2
