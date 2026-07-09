from app.models.portfolio import Watchlist

def add_watchlist(database,user_id,data):

    saving = Watchlist(
        user_id = user_id,
        ticker = data.ticker,
        company_name = data.company_name,
        sector = data.sector
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

