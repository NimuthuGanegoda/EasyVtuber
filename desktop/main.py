#!/usr/bin/env python3
import os
import sys

# Add the project root and backend paths
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)
sys.path.append(os.path.join(current_dir, 'backend'))
sys.path.append(os.path.join(current_dir, 'backend', 'core'))

def main():
    # Import and run the original main from the new location
    from backend.managers.main import main as start_easyvtuber
    start_easyvtuber()

if __name__ == "__main__":
    main()
