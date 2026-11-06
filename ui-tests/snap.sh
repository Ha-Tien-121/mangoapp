#!/usr/bin/env bash
# Runs the UI harness with whatever Python is available.
# One-time setup:  python -m pip install playwright && python -m playwright install chromium
cd "$(dirname "$0")/.." || exit 1
for PY in python3 python py "$HOME/anaconda3/python.exe" "$HOME/miniconda3/python.exe"; do
  if command -v "$PY" >/dev/null 2>&1 && "$PY" -c "import playwright" >/dev/null 2>&1; then
    PYTHONIOENCODING=utf-8 exec "$PY" ui-tests/snap.py "$@"
  fi
done
echo "No Python with Playwright found. Run: python -m pip install playwright && python -m playwright install chromium" >&2
exit 2
