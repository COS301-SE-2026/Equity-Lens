from __future__ import annotations

import argparse
import logging
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models.user import User
from app.services.guest_service import purge_expired_guests

logger = logging.getLogger("purge_guests")
BATCH = 50
GRACE_MINUTES = 15


def count_matching(db, all_guests: bool) -> int:
    stmt = select(func.count(User.id)).where(User.is_guest.is_(True))
    if not all_guests:
        cutoff = datetime.now(UTC) - timedelta(minutes=GRACE_MINUTES)
        stmt = stmt.where(User.guest_expires_at < cutoff)
    return int(db.scalar(stmt) or 0)


def purge(dry_run: bool = False, all_guests: bool = False) -> int:
    db = SessionLocal()
    try:
        if dry_run:
            return count_matching(db, all_guests)

        total = 0
        while True:
            deleted = purge_expired_guests(
                db, limit=BATCH, grace_minutes=GRACE_MINUTES, all_guests=all_guests
            )
            db.commit()
            total += deleted
            if deleted < BATCH:
                return total
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Delete expired guest sessions.")
    parser.add_argument("--dry-run", action="store_true", help="count only, delete nothing")
    parser.add_argument("--all-guests", action="store_true", help="every guest, expired or not")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

    count = purge(dry_run=args.dry_run, all_guests=args.all_guests)
    logger.info("%s %s guest sessions", "would delete" if args.dry_run else "deleted", count)
    return 0


if __name__ == "__main__":
    sys.exit(main())
