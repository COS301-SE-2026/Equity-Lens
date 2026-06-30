from fastapi import Depends
from app.dependencies import get_current_user
from app.database import get_db
from app.schemas.auth import UserResponse
from app.models.portfolio import Holdings, Portfolios
from sqlalchemy.orm import Session


def clean_instrument_news(name: str):
    if name == "10X S&P South Africa Top50 Index Exchange Traded Fund":
        return "South Africa ETF"

    if name == "10X S&P 500 Exchange Traded Fund":
        return "S&P 500 ETF"

    if name == "EasyETFs AI World Actively Managed ETF":
        return "AI ETF"

    if name == "Satrix MSCI Emerging Markets ETF":
        return "Emerging Markets ETF"

    if name == "Trust Account":
        return "South Africa markets"

    return name

def get_portfolio_new(db: Session = Depends(get_db), CurrentUser: UserResponse = Depends(get_current_user)):
    queryPortfolio = (db.query(Holdings.instrument_name).join(Portfolios, Holdings.portfolio_id == Portfolios.id).filter(Portfolios.user_id == CurrentUser.id).order_by(Holdings.weight_percentage.desc()).limit(3).all())

    allKeywords = []

    for keywordsQuery in queryPortfolio:
        allKeywordsName = clean_instrument_news(keywordsQuery.instrument_name)
        allKeywords.append(allKeywordsName)

    return " OR ".join(allKeywords)

