from fastapi import APIRouter
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()


@router.get("/news")
def get_news():

    mock_data = {
        "status": "ok",
        "totalResults": 10,
        "articles": [
            {
                "title": "Here's what Wall Street doesn't get about young investors, according to a Gen Z founder",
                "description": "Eve Halimi and Anam Lakhani created Alinea, an investment platform designed for the next generation of wealth-builders, in 2021.",
                "url": "https://www.businessinsider.com/personal-finance/gen-zalinea-founder-explains-how-to-connect-with-investors-2026-4"
            },
            {
                "title": "Firefighter testifies he lost most of $110K in retirement savings after investing in companies criticized by Andrew Left",
                "description": "Retail investors testified in the fraud trial of Andrew Left, with one saying he lost most of his 401(k) in stocks the short seller criticized.",
                "url": "https://www.businessinsider.com/retail-investor-lost-retirement-savings-stocks-andrew-left-trial-2026-5"
            },
            {
                "title": "Retail traders are trimming holdings of longtime AI favorite Palantir in a pivot from software stocks",
                "description": "Palantir has long been a favorite of the retail crowd, but a frenzy for other AI plays has turned the cohort into sellers.",
                "url": "https://www.businessinsider.com/palantir-stock-sell-retail-traders-ai-memory-chips-pltr-msft-2026-5"
            },
            {
                "title": "Billionaire hedge fund investor Paul Tudor Jones says this is where he's eyeing his next big bet in markets",
                "description": "Paul Tudor Jones says his investing career has been like a boxing match.",
                "url": "https://www.businessinsider.com/paul-tudor-jones-investing-opportunities-japan-yen-sanae-takaichi-2026-4"
            },
            {
                "title": "I have 500 Pokémon and K-pop cards. I talked to a pro assessor to see if I made a bad investment.",
                "description": "A collector explored whether Pokémon and K-pop cards can become profitable investments.",
                "url": "https://www.businessinsider.com/card-collecting-pokemon-kpop-photocard-pro-assessor-value-psa-grading-2026-4"
            },
            {
                "title": "Poppi's cofounder on why she put $5,000 in each of her children's investment accounts",
                "description": "Poppi cofounder Allison Ellsworth said she's teaching her children to invest.",
                "url": "https://www.businessinsider.com/poppi-cofounder-allison-ellsworth-children-investment-accounts-2026-5"
            },
            {
                "title": "From Trump beef to 'transitory' inflation, here's what will define Jerome Powell's Fed legacy",
                "description": "Market professionals debate Jerome Powell’s legacy as Federal Reserve chairman.",
                "url": "https://www.businessinsider.com/jerome-powell-federal-reserve-legacy-transitory-inflation-interest-rates-trump-2026-4"
            },
            {
                "title": "One of the most stressful jobs in finance right now: private credit sales",
                "description": "Private credit sales teams face increasing pressure amid rising redemptions.",
                "url": "https://www.businessinsider.com/private-credit-sales-fundraising-stress-redemptions-2026-4"
            },
            {
                "title": "Wall Street’s Stablecoin Darling Raises $222 Million to Starve Ethereum",
                "description": "Ethereum's relevance continues to decline as crypto aligns with institutions.",
                "url": "https://gizmodo.com/wall-streets-stablecoin-darling-raises-222-million-to-starve-ethereum-2000757094"
            },
            {
                "title": "Diameter's Scott Goodwin says some private credit portfolios are 'almost criminal'",
                "description": "Diameter Capital says some private credit portfolios are dangerously structured.",
                "url": "https://www.businessinsider.com/scott-goodwin-private-credit-loaded-software-almost-criminal-2026-5"
            }
        ]
    }

    return mock_data