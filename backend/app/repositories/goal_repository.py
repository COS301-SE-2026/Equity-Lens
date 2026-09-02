from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.goal import Goal


class GoalRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_latest(self, user_id: UUID) -> Goal | None:
        stmt = (
            select(Goal)
            .where(Goal.user_id == user_id)
            .order_by(Goal.created_at.desc())
        )
        return self.db.scalars(stmt).first()

    def create(self, user_id: UUID, **fields) -> Goal:
        goal = Goal(user_id=user_id, **fields)
        self.db.add(goal)
        return goal