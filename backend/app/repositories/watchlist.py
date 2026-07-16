from app.models.portfolio import Watchlist

def add_watchlist(database,user_id,ticker,company_name,sector):

    saving = Watchlist(
        user_id = user_id,
        ticker = ticker,
        company_name = company_name,
        sector = sector
    )

    database.add(saving)
    database.commit()
    database.refresh(saving)

    return saving

def get_watchlist(database,user_id):
    return(database.query(Watchlist).filter(Watchlist.user_id == user_id).all())


def remove_watchlist(database,user_id,watchlistID):

    watchlists = (database.query(Watchlist).filter(Watchlist.user_id == user_id, Watchlist.id == watchlistID).first())

    database.delete(watchlists)
    database.commit()

