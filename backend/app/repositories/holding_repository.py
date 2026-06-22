from uuid import UUID, uuid4
from sqlalchemy.orm import Session
from app.models.holding import Holding

class HoldingRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_holding(self, user_id: UUID, **kwargs) -> Holding:
        holding = Holding(id=uuid4(), user_id=user_id, **kwargs)
        self.db.add(holding)
        self.db.commit()
        self.db.refresh(holding)
        return holding

    def get_holdings_by_user(self, user_id: UUID) -> list[Holding]:
        return self.db.query(Holding).filter(Holding.user_id == user_id).all()

    def get_holding_by_id(self, holding_id: UUID, user_id: UUID) -> Holding | None:
        return self.db.query(Holding).filter(Holding.id == holding_id, Holding.user_id == user_id).first()

    def update_holding(self, holding: Holding, **kwargs) -> Holding:
        for key, value in kwargs.items():
            if value is not None:
                setattr(holding, key, value)
        self.db.commit()
        self.db.refresh(holding)
        return holding

    def delete_holding(self, holding: Holding) -> None:
        self.db.delete(holding)
        self.db.commit()