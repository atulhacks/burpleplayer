#!/usr/bin/env python3
"""Print the latest opt-in BurplePlayer frame-timing report."""

import argparse
import json
import sqlite3
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--webkit-root",
        type=Path,
        default=Path.home() / "Library/WebKit/com.burpleplayer.desktop",
    )
    args = parser.parse_args()

    reports = []
    for database in args.webkit_root.rglob("localstorage.sqlite3"):
        try:
            with sqlite3.connect(database.as_uri() + "?mode=ro", uri=True) as conn:
                rows = conn.execute(
                    "SELECT value FROM ItemTable WHERE key = ?",
                    ("burple.perf-audit",),
                )
                for (raw,) in rows:
                    # WebKit stores localStorage strings as UTF-16LE BLOBs.
                    reports.append(json.loads(raw.decode("utf-16-le")))
        except (OSError, sqlite3.Error, UnicodeError, json.JSONDecodeError):
            continue

    if not reports:
        parser.exit(1, "No BurplePlayer performance report found.\n")

    latest = max(reports, key=lambda report: report.get("measuredAt", ""))
    print(json.dumps(latest, indent=2))


if __name__ == "__main__":
    main()
