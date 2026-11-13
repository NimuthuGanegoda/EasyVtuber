"""Make the desktop package importable from tests without per-file sys.path hacks.

`desktop/backend/core` is on the path because the vendored THA2 code imports
itself as a top-level `tha2` package.
"""

import os
import sys

DESKTOP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORE_ROOT = os.path.join(DESKTOP_ROOT, 'backend', 'core')

for path in (DESKTOP_ROOT, CORE_ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)
