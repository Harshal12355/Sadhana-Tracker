"""Build the verse-number index the in-app Shastra reader uses to step to the next verse.

Only verse *numbers* are collected (e.g. Bg 1.16-18 is one combined page), never any text:
the scripture text stays on vedabase.io, which shows it under BBT permission.

Usage:  python3 scripts/build_vedabase_index.py            # all books
        python3 scripts/build_vedabase_index.py bg iso      # some books
Writes one JSON file per book to src/reader/index/<code>.json.
"""

from __future__ import annotations

import json
import re
import ssl
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = "https://vedabase.io/en/library/"
OUT_DIR = Path(__file__).resolve().parents[1] / "src" / "reader" / "index"

# Book code -> number of levels below the book down to one readable page.
BOOK_DEPTH = {"bg": 2, "sb": 3, "cc": 3, "nod": 1, "noi": 1, "iso": 1, "spl": 2}

_NUMBERED = re.compile(r"^\d+(-\d+)?$")
_CC_LILAS = ("adi", "madhya", "antya")


def _ssl_context() -> ssl.SSLContext:
    bundle = Path("/root/.ccr/ca-bundle.crt")
    if bundle.is_file():
        return ssl.create_default_context(cafile=str(bundle))
    return ssl.create_default_context()


_CTX = _ssl_context()


def fetch_children(path: str) -> list[str]:
    """Return numbered child slugs of a library page, in page order, front matter dropped."""
    url = f"{BASE}{path}/"
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "sadhana-valli-index/1.0"})
            with urllib.request.urlopen(req, context=_CTX, timeout=30) as res:
                html = res.read().decode("utf-8", "replace")
            break
        except Exception:  # noqa: BLE001 - retry any network error
            if attempt == 3:
                raise
            time.sleep(2 ** (attempt + 1))
    pattern = re.compile(r"library/" + re.escape(path) + r"/([^/\"#?]+)/")
    seen: list[str] = []
    for slug in pattern.findall(html):
        keep = _NUMBERED.match(slug) or (path == "cc" and slug in _CC_LILAS)
        if keep and slug not in seen:
            seen.append(slug)
    return seen


def build_book(code: str) -> dict[str, list[str]]:
    """Map each parent path (relative to the book) to its ordered leaf slugs."""
    depth = BOOK_DEPTH[code]
    parents = [""]
    for _ in range(depth - 1):
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda p: fetch_children(f"{code}/{p}".rstrip("/")), parents))
        parents = [f"{p}/{c}".lstrip("/") for p, kids in zip(parents, results) for c in kids]
    with ThreadPoolExecutor(max_workers=4) as pool:
        leaves = list(pool.map(lambda p: fetch_children(f"{code}/{p}".rstrip("/")), parents))
    return {p: kids for p, kids in zip(parents, leaves) if kids}


def main(codes: list[str]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for code in codes:
        groups = build_book(code)
        total = sum(len(v) for v in groups.values())
        out = OUT_DIR / f"{code}.json"
        out.write_text(json.dumps(groups, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"{code}: {len(groups)} groups, {total} readable pages -> {out.name}")


if __name__ == "__main__":
    main(sys.argv[1:] or list(BOOK_DEPTH))
