# from fastapi import APIRouter, Depends
# from sqlalchemy.orm import Session

# from app.database import get_db
# from app.dependencies import get_current_user
# from app.models.user import User
# from app.services.portfolio_service import PortfolioService

# router = APIRouter(prefix="/api/portfolio", tags=["Portfolio"])

# @router.get("")
# def get_portfolio(
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     return PortfolioService(db).get_dashboard(current_user.id)


# @router.get("/summary")
# def get_summary(
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     return PortfolioService(db).get_summary(current_user.id)


# @router.get("/sectors")
# def get_sectors(
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     return PortfolioService(db).get_sector_allocation(current_user.id)


# @router.get("/performance")
# def get_performance(
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     return PortfolioService(db).get_performance_history(current_user.id)