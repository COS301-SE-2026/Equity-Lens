from uuid import UUID, uuid4
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.portfolio import (
    Document,
    Portfolios,
    PortfolioSnapshot,
    Holdings,
    InstrumentPurchasesAndSales,
    ContributionsAndWithdrawals,
    DividendsAndWithholdingTax,
    TransactionExpenses,
    Watchlist,
)
from app.models.chat import ChatConversation, ChatMessages

class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_user(self, email: str, hashed_password: str, full_name: str) -> User:
        user = User(id=uuid4(), email=email, hashed_password=hashed_password, full_name=full_name)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).first()

    def get_by_id(self, user_id: UUID) -> User | None:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_cognito_sub(self, cognito_sub: str) -> User | None:
        return self.db.query(User).filter(User.cognito_sub == cognito_sub).first()

    def get_or_create_cognito_user(self, cognito_sub: str, email: str, full_name: str) -> User:
        user = self.get_by_cognito_sub(cognito_sub)
        if user:
            return user
        
        # user = self.get_by_email(email)
        # if user:
        #     user.cognito_sub = cognito_sub
        #     self.db.commit()
        #     self.db.refresh(user)
        #     return user

        user = User(id=uuid4(), email=email, hashed_password=None, full_name=full_name, cognito_sub=cognito_sub)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def user_exists(self, email: str) -> bool:
        return self.db.query(User.id).filter(User.email == email).first() is not None

    def delete_account(self, user: User) -> None:
        user_id = user.id
        portfolio_ids = [
            row.id for row in self.db.query(Portfolios.id).filter(Portfolios.user_id == user_id).all()
        ]
        conversation_ids = [
            row.id for row in self.db.query(ChatConversation.id).filter(ChatConversation.user_id == user_id).all()
        ]

        try:
            self.db.delete(user)
            self.db.flush()
            #Backup delete to ensure everything removed incase CASCADE failed
            if portfolio_ids:
                self.db.query(Holdings).filter(Holdings.portfolio_id.in_(portfolio_ids)).delete(synchronize_session=False)
                self.db.query(InstrumentPurchasesAndSales).filter(InstrumentPurchasesAndSales.portfolio_id.in_(portfolio_ids)).delete(synchronize_session=False)
                self.db.query(ContributionsAndWithdrawals).filter(ContributionsAndWithdrawals.portfolio_id.in_(portfolio_ids)).delete(synchronize_session=False)
                self.db.query(DividendsAndWithholdingTax).filter(DividendsAndWithholdingTax.portfolio_id.in_(portfolio_ids)).delete(synchronize_session=False)
                self.db.query(TransactionExpenses).filter(TransactionExpenses.portfolio_id.in_(portfolio_ids)).delete(synchronize_session=False)
                self.db.query(PortfolioSnapshot).filter(PortfolioSnapshot.portfolio_id.in_(portfolio_ids)).delete(synchronize_session=False)
                self.db.query(Portfolios).filter(Portfolios.id.in_(portfolio_ids)).delete(synchronize_session=False)

            if conversation_ids:
                self.db.query(ChatMessages).filter(ChatMessages.conversation_id.in_(conversation_ids)).delete(synchronize_session=False)
                self.db.query(ChatConversation).filter(ChatConversation.id.in_(conversation_ids)).delete(synchronize_session=False)

            self.db.query(Document).filter(Document.user_id == user_id).delete(synchronize_session=False)
            self.db.query(Watchlist).filter(Watchlist.user_id == user_id).delete(synchronize_session=False)

            self.db.commit()
        except Exception:
            self.db.rollback()
            raise