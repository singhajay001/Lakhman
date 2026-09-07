"""Command line entry points: `python -m agent.cli <command>`."""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from agent.config import settings
from agent.db import init_db
from agent.ingest.myfoodlink import ingest
from agent.notify import telegram
from agent.reporting import weekly


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="agent")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    ingest_cmd = sub.add_parser("ingest", help="load MyFoodLink exports from the inbox")
    ingest_cmd.add_argument("--inbox", type=Path, default=settings.inbox_dir)

    report_cmd = sub.add_parser("report", help="print the weekly report")
    report_cmd.add_argument("--days", type=int, default=7)
    report_cmd.add_argument("--send", action="store_true", help="also send it to Telegram")

    sub.add_parser("init-db", help="create tables")

    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )

    if args.command == "init-db":
        init_db()
        print("database ready")
        return 0

    if args.command == "ingest":
        init_db()
        print(ingest(args.inbox))
        return 0

    if args.command == "report":
        init_db()
        text = weekly.build(window_days=args.days)
        print(text)
        if args.send and not telegram.send_message(text):
            print("could not send to Telegram - check the token and chat id", file=sys.stderr)
            return 1
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
