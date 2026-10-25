import logging
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.schemas.responses import AppError
from app.services.portfolio_service import invalidate_priced_holdings

logger = logging.getLogger(__name__)

START_LOCK_ID = 3012027
PURGE_LOCK_ID = 3012028


def _is_postgres(db: Session) -> bool:
    return db.get_bind().dialect.name == "postgresql"


def purge_expired_guests(
    db: Session, limit: int = 50, grace_minutes: int = 15, all_guests: bool = False
) -> int:
    # the caller commits. two purges at once would only fight over the same rows, so one skips
    if _is_postgres(db):
        got_lock = db.scalar(text("SELECT pg_try_advisory_xact_lock(:id)"), {"id": PURGE_LOCK_ID})
        if not got_lock:
            return 0

    doomed = select(User.id).where(User.is_guest.is_(True))
    if not all_guests:
        cutoff = datetime.now(UTC) - timedelta(minutes=grace_minutes)
        doomed = doomed.where(User.guest_expires_at < cutoff)

    deleted = list(
        db.scalars(
            delete(User)
            .where(User.id.in_(doomed.limit(limit)))
            .returning(User.id)
            .execution_options(synchronize_session=False)
        )
    )

    for user_id in deleted:
        invalidate_priced_holdings(user_id)
    if deleted:
        logger.info("purged %s guest sessions", len(deleted))
    return len(deleted)


def start_guest(db: Session) -> tuple[User, datetime]:
    purge_expired_guests(db)
    db.commit()

    if _is_postgres(db):
        db.execute(text("SELECT pg_advisory_xact_lock(:id)"), {"id": START_LOCK_ID})

    now = datetime.now(UTC)
    active = db.scalar(
        select(func.count(User.id)).where(
            User.is_guest.is_(True), User.guest_expires_at > now
        )
    )
    if active >= settings.guest_max_active:
        db.rollback()
        raise AppError(
            503,
            "GUEST_CAPACITY",
            "the demo is busy, try again in a minute",
            headers={"Retry-After": "60"},
        )

    expires_at = now + timedelta(hours=settings.guest_session_hours)
    user = User(
        email=f"guest-{uuid4().hex}@guest.invalid",
        full_name="Guest",
        is_guest=True,
        is_active=True,
        guest_expires_at=expires_at,
    )
    db.add(user)
    db.commit()

    logger.info("guest session %s started", user.id)
    return user, expires_at


def end_guest(db: Session, user: User) -> None:
    if not user.is_guest:
        raise AppError(403, "FORBIDDEN", "only a guest session can be ended")

    user_id = user.id
    db.execute(delete(User).where(User.id == user_id, User.is_guest.is_(True)))
    db.commit()
    invalidate_priced_holdings(user_id)
    logger.info("guest session %s ended", user_id)
