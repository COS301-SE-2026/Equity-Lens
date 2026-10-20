import io
import time
from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import UUID

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models.chat import ChatConversation, ChatMessages, UserMemory
from app.models.news_event import NewsArticle
from app.models.portfolio import (
    ContributionsAndWithdrawals,
    DividendsAndWithholdingTax,
    Document,
    Holdings,
    InstrumentPurchasesAndSales,
    Portfolios,
    TransactionExpenses,
    Watchlist,
)
from app.models.user import User
from app.repositories import import_pdf as import_repo
from app.repositories.portfolio_repository import PortfolioRepository
from app.repositories.user_repository import UserRepository
from app.routers import ai_chat, portfolio_snapshot
from app.schemas.import_pdf import (
    ContributionsAndWithdrawalsRequest,
    DividendsAndWithholdingTaxRequest,
    HoldingsRequest,
    InstrumentPurchasesAndSalesRequest,
    TransactionExpensesRequest,
)
from app.schemas.responses import AppError
from app.scripts import purge_guests
from app.services import guest_service, token_verifier
from app.services import import_pdf as import_service
from app.services.guest_token import create_guest_token
from app.utils import ai_rate_limit

GUEST_SECRET = "guest-secret-for-tests-only-0123456789"
REGISTERED_TOKEN = "registered.cognito.token"
SHEETS = (
    Holdings,
    InstrumentPurchasesAndSales,
    ContributionsAndWithdrawals,
    DividendsAndWithholdingTax,
    TransactionExpenses,
)


@pytest.fixture(autouse=True)
def guest_mode(monkeypatch):
    monkeypatch.setattr(settings, "guest_mode_enabled", True)
    monkeypatch.setattr(settings, "guest_token_secret", GUEST_SECRET)
    ai_rate_limit._HITS.clear()
    yield
    ai_rate_limit._HITS.clear()


@pytest.fixture
def registered(test_user):
    def verify(token):
        if token != REGISTERED_TOKEN:
            raise AppError(401, "TOKEN_EXPIRED", "invalid or expired token")
        return {"sub": test_user.cognito_sub}

    with patch("app.dependencies.verify_access_token", side_effect=verify):
        yield test_user


def start(client, ip="10.0.0.1"):
    response = client.post("/api/auth/guest", headers={"X-Real-IP": ip})
    assert response.status_code == 201, response.text
    return response.json()


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def guest_headers(session):
    return bearer(session["access_token"])


def guest_row(db_session, session):
    db_session.expire_all()
    return db_session.get(User, UUID(session["user"]["id"]))


def portfolio_of(client, headers):
    response = client.get("/api/import_pdf/my_portfolio", headers=headers)
    assert response.status_code == 200
    return response.json()["portfolio_id"]


def count(db_session, model, **where):
    db_session.expire_all()
    stmt = select(func.count()).select_from(model)
    for column, value in where.items():
        stmt = stmt.where(getattr(model, column) == value)
    return db_session.scalar(stmt)


def _new_portfolio(db_session, user_id, is_guest, document_id=None):
    if document_id is None:
        document = import_repo.save_document(db_session, user_id, SimpleNamespace(file_name="x"))
        document_id = document.id
    body = SimpleNamespace(
        document_id=document_id,
        account_number="1",
        portfolio_name="extra",
        statement_start_date=None,
        statement_end_date=date(2026, 9, 29),
        account_type="zar",
    )
    return import_repo.save_portfolios(db_session, user_id, body, is_guest=is_guest)


def _child_bodies(portfolio_id):
    return {
        "/api/import_pdf/save_holdings": {
            "portfolio_id": portfolio_id, "instrument_name": "Naspers Limited", "ticker": " ",
            "sector": " ", "quantity": 1, "total_cost": 100, "cost_price": 100,
            "weight_percentage": 1,
        },
        "/api/import_pdf/save_instrument_purchases_and_sales": {
            "portfolio_id": portfolio_id, "transaction_date": "2026-01-02",
            "transaction_name": "Buy", "instrument_name": "Naspers Limited", "ticker": " ",
            "sector": " ", "price": 100, "quantity": 1, "value_zar": 100,
        },
        "/api/import_pdf/save_contributions_and_withdrawals": {
            "portfolio_id": portfolio_id, "transaction_date": "2026-01-02",
            "settlement_date": "2026-01-02", "transaction_name": "Contribution", "value_zar": 100,
        },
        "/api/import_pdf/save_dividends_and_withholding_tax": {
            "portfolio_id": portfolio_id, "transaction_date": "2026-01-02",
            "instrument_name": "Naspers Limited", "ticker": " ", "sector": " ",
            "gross_dividend": 10, "withholding_tax": 2, "net_dividend": 8, "tax_rate": 20,
        },
        "/api/import_pdf/save_transaction_expenses": {
            "portfolio_id": portfolio_id, "transaction_date": "2026-01-02",
            "settlement_date": "2026-01-02", "narrative_name": "Brokerage fee", "value_zar": 5,
        },
    }


def import_statement(client, db_session, headers, user_id, is_guest=True):
    document = client.post("/api/import_pdf/", json={"file_name": "statement.xlsx"},
                           headers=headers)
    assert document.status_code == 200, document.text
    portfolio = _new_portfolio(
        db_session, user_id, is_guest, document_id=UUID(document.json()["document_id"])
    )
    portfolio_id = str(portfolio.id)
    for url, body in _child_bodies(portfolio_id).items():
        response = client.post(url, json=body, headers=headers)
        assert response.status_code == 200, (url, response.text)
    return portfolio_id


def import_as_guest(client, db_session, session):
    user_id = guest_row(db_session, session).id
    return import_statement(client, db_session, guest_headers(session), user_id)


def assert_rejected(response):
    assert response.status_code == 401, response.text
    assert response.json()["error_code"] == "TOKEN_EXPIRED"

@pytest.mark.parametrize(
    ("enabled", "secret"),
    [(False, GUEST_SECRET), (True, "x" * 31), (True, None)],
)
def test_guest_mode_off_or_without_a_usable_secret_refuses(client, monkeypatch, enabled, secret):
    monkeypatch.setattr(settings, "guest_mode_enabled", enabled)
    monkeypatch.setattr(settings, "guest_token_secret", secret)

    assert client.get("/api/auth/guest").json() == {"enabled": False}
    response = client.post("/api/auth/guest")
    assert response.status_code == 404
    assert response.json()["error_code"] == "GUEST_MODE_DISABLED"


def test_a_secret_of_exactly_32_characters_is_enough(client, monkeypatch):
    monkeypatch.setattr(settings, "guest_token_secret", "x" * 32)
    assert client.get("/api/auth/guest").json() == {"enabled": True}


def test_switching_guest_mode_off_rejects_tokens_already_issued(client, monkeypatch):
    session = start(client)
    assert client.get("/api/auth/me", headers=guest_headers(session)).status_code == 200

    monkeypatch.setattr(settings, "guest_mode_enabled", False)
    assert_rejected(client.get("/api/auth/me", headers=guest_headers(session)))

def test_starting_a_guest_creates_a_signed_token_and_a_throwaway_user(client, db_session):
    response = client.post("/api/auth/guest", headers={"X-Real-IP": "10.0.0.1"})
    assert response.status_code == 201
    body = response.json()

    header = jwt.get_unverified_header(body["access_token"])
    assert header["alg"] == "HS256"
    assert header["kid"] == "guest-v1"
    claims = jwt.decode(
        body["access_token"], GUEST_SECRET, algorithms=["HS256"], audience="equitylens-api"
    )
    assert claims["iss"] == "equitylens-guest"
    assert claims["token_use"] == "guest"
    assert claims["sub"] == body["user"]["id"]
    assert claims["jti"]
    assert abs(claims["exp"] - claims["iat"] - 4 * 3600) <= 5

    assert body["token_type"] == "bearer"
    assert body["user"] == {"id": body["user"]["id"], "full_name": "Guest", "is_guest": True}
    assert "email" not in body["user"]
    assert "@" not in response.text

    user = guest_row(db_session, body)
    assert user.is_guest is True
    assert user.email.endswith("@guest.invalid")
    assert user.cognito_sub is None
    assert user.hashed_password is None


def test_a_new_guest_starts_with_an_empty_account(client, db_session):
    session = start(client)
    user_id = guest_row(db_session, session).id

    assert count(db_session, User) == 1
    assert count(db_session, Document, user_id=user_id) == 0
    assert count(db_session, Portfolios, user_id=user_id) == 0
    assert count(db_session, Holdings) == 0
    mine = client.get("/api/import_pdf/my_portfolio", headers=guest_headers(session))
    assert mine.status_code == 200
    assert mine.json() == {"Found": False, "portfolio_id": None}


def test_a_guest_imports_their_own_statement(client, db_session):
    session = start(client)
    portfolio_id = import_as_guest(client, db_session, session)

    assert portfolio_of(client, guest_headers(session)) == portfolio_id
    for model in SHEETS:
        assert count(db_session, model, portfolio_id=UUID(portfolio_id)) == 1, model.__name__
    holding = db_session.scalars(select(Holdings)).one()
    assert (holding.ticker, holding.sector) == ("NPN.JO", "Technology")


def test_a_guest_import_of_a_name_outside_the_catalogue_searches_yahoo(client, db_session):
    session = start(client)
    portfolio_id = import_as_guest(client, db_session, session)
    body = _child_bodies(portfolio_id)["/api/import_pdf/save_holdings"]
    body["instrument_name"] = "Mr Price Group"
    found = {"Found": True, "ticker": "MRP.JO", "sector": "Consumer Discretionary"}

    with patch.dict(import_service.Cache, clear=True), \
         patch.object(import_service, "_search_ticker_number_uncached",
                      return_value=found) as search:
        response = client.post(
            "/api/import_pdf/save_holdings", json=body, headers=guest_headers(session)
        )

    assert response.status_code == 200
    search.assert_called_once_with("Mr Price Group")
    stored = db_session.scalars(
        select(Holdings).where(Holdings.instrument_name == "Mr Price Group")
    ).one()
    assert (stored.ticker, stored.sector) == ("MRP.JO", "Consumer Discretionary")


def test_a_guest_sees_an_empty_email_and_is_flagged(client):
    session = start(client)
    me = client.get("/api/auth/me", headers=guest_headers(session)).json()

    assert me["email"] == ""
    assert me["is_guest"] is True
    assert me["full_name"] == "Guest"

def test_guest_requests_never_call_cognito(client):
    no_cognito = AssertionError("cognito")
    with patch("app.dependencies.cognito_get_user", side_effect=no_cognito) as get_user, \
         patch.object(UserRepository, "get_or_create_cognito_user",
                      side_effect=AssertionError("relink")) as relink, \
         patch("app.dependencies.verify_access_token",
               side_effect=AssertionError("jwks")) as verify:
        session = start(client)
        headers = guest_headers(session)
        assert client.get("/api/auth/me", headers=headers).status_code == 200
        assert client.get("/api/import_pdf/my_portfolio", headers=headers).status_code == 200
        assert client.get("/api/portfolio/summary", headers=headers).status_code == 200

    get_user.assert_not_called()
    relink.assert_not_called()
    verify.assert_not_called()

def _claims(sub, **overrides):
    now = int(time.time())
    claims = {
        "iss": "equitylens-guest",
        "aud": "equitylens-api",
        "sub": str(sub),
        "token_use": "guest",
        "iat": now,
        "exp": now + 3600,
    }
    claims.update(overrides)
    return claims


@pytest.fixture
def cognito_refuses():
    refusal = AppError(401, "TOKEN_EXPIRED", "invalid or expired token")
    with patch("app.dependencies.cognito_get_user", side_effect=refusal) as get_user:
        yield get_user


def test_an_expired_guest_token_is_rejected(client, db_session):
    session = start(client)
    user = guest_row(db_session, session)
    expired = create_guest_token(user.id, datetime.now(UTC) - timedelta(minutes=5))

    assert_rejected(client.get("/api/auth/me", headers=bearer(expired)))


def test_a_guest_token_signed_with_another_secret_is_rejected(client, db_session):
    session = start(client)
    user = guest_row(db_session, session)
    forged = jwt.encode(
        _claims(user.id), "not-the-server-secret-but-long-enough", algorithm="HS256",
        headers={"kid": "guest-v1"},
    )

    assert_rejected(client.get("/api/auth/me", headers=bearer(forged)))


def test_an_unsigned_token_is_rejected(client, db_session, cognito_refuses):
    session = start(client)
    user = guest_row(db_session, session)
    unsigned = jwt.encode(_claims(user.id), None, algorithm="none", headers={"kid": "guest-v1"})

    assert_rejected(client.get("/api/auth/me", headers=bearer(unsigned)))
    cognito_refuses.assert_called_once()


def test_the_guest_kid_with_another_algorithm_is_not_treated_as_a_guest(
    client, db_session, cognito_refuses
):
    session = start(client)
    user = guest_row(db_session, session)
    other_alg = jwt.encode(
        _claims(user.id), GUEST_SECRET, algorithm="HS512", headers={"kid": "guest-v1"}
    )

    with patch("app.dependencies.verify_guest_token") as guest_verifier:
        assert_rejected(client.get("/api/auth/me", headers=bearer(other_alg)))

    guest_verifier.assert_not_called()
    cognito_refuses.assert_called_once()


def test_a_guest_secret_token_without_the_kid_goes_to_cognito(client, db_session, cognito_refuses):
    session = start(client)
    user = guest_row(db_session, session)
    no_kid = jwt.encode(_claims(user.id), GUEST_SECRET, algorithm="HS256")

    with patch("app.dependencies.verify_guest_token") as guest_verifier:
        assert_rejected(client.get("/api/auth/me", headers=bearer(no_kid)))

    guest_verifier.assert_not_called()
    cognito_refuses.assert_called_once()


def test_a_purged_guest_is_rejected_while_its_token_is_still_valid(client, db_session):
    session = start(client)
    guest_service.purge_expired_guests(db_session, all_guests=True)
    db_session.commit()

    assert_rejected(client.get("/api/auth/me", headers=guest_headers(session)))


def test_a_guest_token_for_a_registered_user_is_rejected(client, test_user):
    forged = create_guest_token(test_user.id, datetime.now(UTC) + timedelta(hours=1))

    assert_rejected(client.get("/api/auth/me", headers=bearer(forged)))


def test_a_guest_token_whose_sub_is_not_a_uuid_is_rejected(client):
    token = jwt.encode(_claims("not-a-uuid"), GUEST_SECRET, algorithm="HS256",
                       headers={"kid": "guest-v1"})

    assert_rejected(client.get("/api/auth/me", headers=bearer(token)))


@pytest.mark.parametrize("token", ["null", "abc"])
def test_a_malformed_bearer_is_a_401_not_a_500(client, token):
    token_verifier._jwk_client.cache_clear()
    try:
        with patch.object(settings, "aws_cognito_user_pool_id", "af-south-1_TESTPOOL"), \
             patch("app.dependencies.cognito_get_user") as get_user:
            assert_rejected(client.get("/api/auth/me", headers=bearer(token)))
        get_user.assert_not_called()
    finally:
        token_verifier._jwk_client.cache_clear()

def test_a_registered_user_still_resolves_through_the_cognito_path(client, registered):
    response = client.get("/api/auth/me", headers=bearer(REGISTERED_TOKEN))

    assert response.status_code == 200
    assert response.json()["email"] == registered.email
    assert response.json()["is_guest"] is False

def _owner_routes(portfolio_id):
    return [
        ("get", f"/api/portfolio_snapshot/{portfolio_id}"),
        ("get", f"/api/portfolio_snapshot/{portfolio_id}/download"),
        ("delete", f"/api/import_pdf/portfolios/{portfolio_id}"),
    ]


def _assert_cannot_reach(client, db_session, headers, owner_id, portfolio_id):
    for method, url in _owner_routes(portfolio_id):
        response = getattr(client, method)(url, headers=headers)
        assert response.status_code == 404, (url, response.status_code)
    assert count(db_session, Portfolios, user_id=owner_id) == 1


def test_one_guest_cannot_reach_another_guests_portfolio(client, db_session):
    a = start(client, ip="10.0.0.1")
    b = start(client, ip="10.0.0.2")
    a_id = guest_row(db_session, a).id
    portfolio_id = import_as_guest(client, db_session, a)

    _assert_cannot_reach(client, db_session, guest_headers(b), a_id, portfolio_id)


def test_a_guest_and_a_registered_user_cannot_reach_each_other(client, db_session, registered):
    guest = start(client)
    guest_id = guest_row(db_session, guest).id
    guest_portfolio = import_as_guest(client, db_session, guest)
    registered_portfolio = import_statement(
        client, db_session, bearer(REGISTERED_TOKEN), registered.id, is_guest=False
    )

    _assert_cannot_reach(
        client, db_session, guest_headers(guest), registered.id, registered_portfolio
    )
    _assert_cannot_reach(
        client, db_session, bearer(REGISTERED_TOKEN), guest_id, guest_portfolio
    )


@pytest.mark.usefixtures("registered")
def test_summaries_only_count_the_callers_own_holdings(client, db_session):
    a = start(client, ip="10.0.0.1")
    b = start(client, ip="10.0.0.2")
    import_as_guest(client, db_session, a)

    def holdings(headers):
        return client.get("/api/portfolio/summary", headers=headers).json()["num_holdings"]

    assert holdings(guest_headers(a)) == 1
    assert holdings(guest_headers(b)) == 0
    assert holdings(bearer(REGISTERED_TOKEN)) == 0


@pytest.mark.usefixtures("registered")
def test_chats_memories_and_watchlists_stay_with_their_owner(client, db_session):
    a = start(client, ip="10.0.0.1")
    b = start(client, ip="10.0.0.2")
    a_id = guest_row(db_session, a).id

    conversation = ChatConversation(user_id=a_id, title="mine")
    db_session.add(conversation)
    db_session.flush()
    db_session.add(ChatMessages(conversation_id=conversation.id, role="user", content="hello"))
    memory = UserMemory(user_id=a_id, fact="likes banks")
    item = Watchlist(user_id=a_id, ticker="NPN.JO", company_name="Naspers", sector="Technology")
    db_session.add_all([memory, item])
    db_session.commit()

    for headers in (guest_headers(b), bearer(REGISTERED_TOKEN)):
        messages = client.get(
            f"/api/ai_chat/conversations/{conversation.id}/messages/", headers=headers
        )
        assert messages.status_code == 404
        assert client.get("/api/ai_chat/conversations/", headers=headers).json() == []
        assert client.get("/api/ai_chat/memories/", headers=headers).json() == []
        forget = client.delete(f"/api/ai_chat/memories/{memory.id}/", headers=headers)
        assert forget.status_code == 404
        with patch("app.services.watchlist.yf.Ticker", side_effect=AssertionError("yahoo")):
            assert client.get("/api/watchlist/", headers=headers).json()["watchlist"] == []

    assert count(db_session, ChatConversation, user_id=a_id) == 1
    assert count(db_session, UserMemory, user_id=a_id) == 1
    assert count(db_session, Watchlist, user_id=a_id) == 1


def test_removing_another_users_watchlist_item_leaves_it_alone(db_engine, db_session, registered):
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        lenient = TestClient(app, raise_server_exceptions=False)
        guest = start(lenient)
        item = Watchlist(user_id=registered.id, ticker="NPN.JO")
        db_session.add(item)
        db_session.commit()

        response = lenient.delete(f"/api/watchlist/{item.id}", headers=guest_headers(guest))
        assert response.status_code >= 400
    finally:
        app.dependency_overrides.clear()

    assert count(db_session, Watchlist, user_id=registered.id) == 1

def _rows_under(db_session, portfolio_id):
    return {
        model.__name__: count(db_session, model, portfolio_id=UUID(portfolio_id))
        for model in SHEETS
    }


def _assert_saves_refused(client, db_session, headers, portfolio_id):
    before = _rows_under(db_session, portfolio_id)
    for url, body in _child_bodies(portfolio_id).items():
        response = client.post(url, json=body, headers=headers)
        assert response.status_code == 404, (url, response.text)
        assert response.json()["detail"] == "The portfolio is not found"
    assert _rows_under(db_session, portfolio_id) == before


def test_a_guest_cannot_write_into_another_guests_portfolio(client, db_session):
    a = start(client, ip="10.0.0.1")
    b = start(client, ip="10.0.0.2")

    _assert_saves_refused(
        client, db_session, guest_headers(b), import_as_guest(client, db_session, a)
    )


def test_a_guest_cannot_write_into_a_registered_users_portfolio(client, db_session, registered):
    guest = start(client)
    portfolio_id = import_statement(
        client, db_session, bearer(REGISTERED_TOKEN), registered.id, is_guest=False
    )

    _assert_saves_refused(client, db_session, guest_headers(guest), portfolio_id)


def test_the_owner_can_still_write_into_their_own_portfolio(client, db_session):
    guest = start(client)
    portfolio_id = import_as_guest(client, db_session, guest)

    for url, body in _child_bodies(portfolio_id).items():
        response = client.post(url, json=body, headers=guest_headers(guest))
        assert response.status_code == 200, (url, response.text)
    assert _rows_under(db_session, portfolio_id) == {
        "Holdings": 2,
        "InstrumentPurchasesAndSales": 2,
        "ContributionsAndWithdrawals": 2,
        "DividendsAndWithholdingTax": 2,
        "TransactionExpenses": 2,
    }

def test_guests_cannot_reach_account_or_mfa_settings(client):
    session = start(client)
    headers = guest_headers(session)

    with patch("app.routers.auth.cognito.cognito_associate_totp", side_effect=AssertionError), \
         patch("app.routers.auth.cognito.cognito_verify_totp", side_effect=AssertionError), \
         patch("app.routers.auth.cognito.cognito_delete_user", side_effect=AssertionError):
        responses = [
            client.post("/api/auth/mfa/associate", headers=headers),
            client.post("/api/auth/mfa/confirm-setup", json={"totp_code": "123456"},
                        headers=headers),
            client.request("DELETE", "/api/auth/me", json={"email": "someone@example.com"},
                           headers=headers),
        ]

    for response in responses:
        assert response.status_code == 403
        assert response.json()["error_code"] == "GUEST_FORBIDDEN"


@pytest.mark.parametrize(
    ("method", "url", "status"),
    [("post", "/api/auth/logout", "logged_out"), ("delete", "/api/auth/guest", "ended")],
)
def test_logout_and_end_session_delete_the_guest(client, db_session, method, url, status):
    session = start(client)
    user_id = guest_row(db_session, session).id

    with patch("app.routers.auth.cognito.cognito_logout", side_effect=AssertionError):
        response = getattr(client, method)(url, headers=guest_headers(session))

    assert response.status_code == 200
    assert response.json() == {"status": status}
    assert count(db_session, User, id=user_id) == 0
    assert_rejected(client.get("/api/auth/me", headers=guest_headers(session)))


def test_a_registered_user_cannot_end_a_guest_session(client, db_session, registered):
    response = client.delete("/api/auth/guest", headers=bearer(REGISTERED_TOKEN))

    assert response.status_code == 403
    assert count(db_session, User, id=registered.id) == 1

def test_the_cap_refuses_new_guests_until_one_expires(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "guest_max_active", 2)
    first = start(client, ip="10.0.0.1")
    start(client, ip="10.0.0.2")

    refused = client.post("/api/auth/guest", headers={"X-Real-IP": "10.0.0.3"})
    assert refused.status_code == 503
    assert refused.json()["error_code"] == "GUEST_CAPACITY"
    assert refused.headers["Retry-After"] == "60"
    assert count(db_session, User) == 2

    user = guest_row(db_session, first)
    user.guest_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.commit()

    assert client.post("/api/auth/guest", headers={"X-Real-IP": "10.0.0.3"}).status_code == 201

def test_one_address_is_limited_but_another_is_not(client, monkeypatch):
    monkeypatch.setattr(settings, "guest_create_per_ip", 2)
    start(client, ip="10.0.0.9")
    start(client, ip="10.0.0.9")

    refused = client.post("/api/auth/guest", headers={"X-Real-IP": "10.0.0.9"})
    assert refused.status_code == 429
    assert refused.json()["error_code"] == "GUEST_RATE_LIMITED"
    assert int(refused.headers["Retry-After"]) > 0

    assert client.post("/api/auth/guest", headers={"X-Real-IP": "10.0.0.10"}).status_code == 201

def _messages(db_session, user_id, how_many):
    conversation = ChatConversation(user_id=user_id, title="chat")
    db_session.add(conversation)
    db_session.flush()
    for i in range(how_many):
        db_session.add(ChatMessages(conversation_id=conversation.id, role="user", content=str(i)))
    db_session.commit()


def test_a_guest_has_a_smaller_daily_ai_allowance(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "guest_ai_daily_limit", 2)
    user = guest_row(db_session, start(client))
    _messages(db_session, user.id, 1)
    assert ai_chat.enforce_limit(db_session, user) is user

    _messages(db_session, user.id, 1)
    with pytest.raises(HTTPException) as caught:
        ai_chat.enforce_limit(db_session, user)
    assert caught.value.status_code == 429
    assert "daily limit of 2" in caught.value.detail["message"]


def test_a_guests_21st_message_of_the_day_is_refused(client, db_session):
    user = guest_row(db_session, start(client))
    _messages(db_session, user.id, 19)
    assert ai_chat.enforce_limit(db_session, user) is user

    _messages(db_session, user.id, 1)
    with pytest.raises(HTTPException) as caught:
        ai_chat.enforce_limit(db_session, user)
    assert caught.value.status_code == 429
    assert "daily limit of 20" in caught.value.detail["message"]


def test_guests_share_one_global_allowance(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "guest_ai_global_daily_limit", 3)
    a = guest_row(db_session, start(client, ip="10.0.0.1"))
    b = guest_row(db_session, start(client, ip="10.0.0.2"))
    _messages(db_session, a.id, 2)
    _messages(db_session, b.id, 1)

    with pytest.raises(HTTPException) as caught:
        ai_chat.enforce_limit(db_session, b)
    assert caught.value.status_code == 429
    assert "guest demo has used today's AI allowance" in caught.value.detail["message"]


def test_registered_users_keep_their_own_allowance(client, db_session, registered, monkeypatch):
    monkeypatch.setattr(settings, "guest_ai_global_daily_limit", 1)
    monkeypatch.setattr(settings, "guest_ai_daily_limit", 1)
    guest = guest_row(db_session, start(client))
    _messages(db_session, guest.id, 2)
    _messages(db_session, registered.id, 5)

    assert ai_chat.enforce_limit(db_session, registered) is registered

def _with_snapshot(client, db_session, session):
    portfolio_id = import_as_guest(client, db_session, session)
    PortfolioRepository(db_session).save_canonical_snapshot(UUID(portfolio_id), "hash", {"a": 1})
    return portfolio_id


@pytest.fixture
def fake_pdf():
    with patch.object(
        portfolio_snapshot, "generate_portfolio_brief",
        side_effect=lambda **_kwargs: io.BytesIO(b"%PDF-1.4 test"),
    ) as builder:
        yield builder


def test_a_guest_can_download_three_pdfs_per_window(client, db_session, fake_pdf):
    session = start(client)
    portfolio_id = _with_snapshot(client, db_session, session)
    url = f"/api/portfolio_snapshot/{portfolio_id}/download"

    for _ in range(3):
        assert client.get(url, headers=guest_headers(session)).status_code == 200
    refused = client.get(url, headers=guest_headers(session))

    assert refused.status_code == 429
    assert "Retry-After" in refused.headers
    assert fake_pdf.call_count == 3


def test_a_full_set_of_pdf_slots_answers_busy(client, db_session, fake_pdf, monkeypatch):
    session = start(client)
    portfolio_id = _with_snapshot(client, db_session, session)
    monkeypatch.setattr(portfolio_snapshot, "PDF_SLOT_TIMEOUT_SECONDS", 0.05)

    held = [portfolio_snapshot._PDF_SLOTS.acquire(blocking=False) for _ in range(2)]
    try:
        assert held == [True, True]
        busy = client.get(f"/api/portfolio_snapshot/{portfolio_id}/download",
                          headers=guest_headers(session))
    finally:
        for _ in held:
            portfolio_snapshot._PDF_SLOTS.release()

    assert busy.status_code == 503
    assert busy.json()["error_code"] == "PDF_BUSY"
    assert busy.headers["Retry-After"] == "5"
    fake_pdf.assert_not_called()


def test_a_failed_build_gives_its_slot_back(db_engine, db_session, monkeypatch):
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(settings, "guest_snapshot_pdf_limit", 50)
    try:
        lenient = TestClient(app, raise_server_exceptions=False)
        session = start(lenient)
        portfolio_id = _with_snapshot(lenient, db_session, session)
        with patch.object(portfolio_snapshot, "generate_portfolio_brief",
                          side_effect=RuntimeError("reportlab fell over")):
            for _ in range(5):
                response = lenient.get(f"/api/portfolio_snapshot/{portfolio_id}/download",
                                       headers=guest_headers(session))
                assert response.status_code == 500
    finally:
        app.dependency_overrides.clear()

    slots = [portfolio_snapshot._PDF_SLOTS.acquire(blocking=False) for _ in range(2)]
    for got in slots:
        if got:
            portfolio_snapshot._PDF_SLOTS.release()
    assert slots == [True, True]

def test_a_cognito_identity_never_takes_over_a_guest_row(client, db_session):
    guest = guest_row(db_session, start(client))
    email = guest.email

    with pytest.raises(IntegrityError):
        UserRepository(db_session).get_or_create_cognito_user("new-sub", email, "Someone")

    db_session.rollback()
    assert guest_row(db_session, {"user": {"id": str(guest.id)}}).cognito_sub is None


def test_a_guest_holds_at_most_three_portfolios(client, db_session):
    user = guest_row(db_session, start(client))

    for _ in range(3):
        _new_portfolio(db_session, user.id, is_guest=True)
    with pytest.raises(AppError) as caught:
        _new_portfolio(db_session, user.id, is_guest=True)

    assert caught.value.status_code == 403
    assert caught.value.error_code == "GUEST_LIMIT"
    assert count(db_session, Portfolios, user_id=user.id) == 3


def test_registered_users_have_no_portfolio_cap(db_session, test_user, monkeypatch):
    monkeypatch.setattr(settings, "guest_max_portfolios", 0)

    _new_portfolio(db_session, test_user.id, is_guest=False)
    assert count(db_session, Portfolios, user_id=test_user.id) == 1


def test_a_guest_watches_at_most_ten_tickers(client):
    session = start(client)
    headers = guest_headers(session)

    with patch("app.services.watchlist.yf.Ticker") as ticker:
        ticker.return_value.info = {"quoteType": "EQUITY", "longName": "Some Co"}
        for i in range(10):
            response = client.post("/api/watchlist/", json={"ticker": f"T{i}.JO"}, headers=headers)
            assert response.status_code == 200
        eleventh = client.post("/api/watchlist/", json={"ticker": "T10.JO"}, headers=headers)

    assert eleventh.status_code == 403
    assert eleventh.json()["error_code"] == "GUEST_LIMIT"
    assert ticker.call_count == 10


@pytest.fixture
def fk_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def _foreign_keys_on(dbapi_connection, _record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = session_factory()
    try:
        yield session, session_factory
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


SAVES = {
    "/api/import_pdf/save_holdings": (import_repo.save_holdings, HoldingsRequest),
    "/api/import_pdf/save_instrument_purchases_and_sales": (
        import_repo.save_instrument_purchases_and_sales, InstrumentPurchasesAndSalesRequest
    ),
    "/api/import_pdf/save_contributions_and_withdrawals": (
        import_repo.save_contributions_and_withdrawals, ContributionsAndWithdrawalsRequest
    ),
    "/api/import_pdf/save_dividends_and_withholding_tax": (
        import_repo.save_dividends_and_withholding_tax, DividendsAndWithholdingTaxRequest
    ),
    "/api/import_pdf/save_transaction_expenses": (
        import_repo.save_transaction_expenses, TransactionExpensesRequest
    ),
}


def _user(db, email, **fields):
    user = User(email=email, full_name="Someone", is_active=True, **fields)
    db.add(user)
    db.commit()
    portfolio = _new_portfolio(db, user.id, is_guest=False)
    for url, body in _child_bodies(str(portfolio.id)).items():
        save, request = SAVES[url]
        if "instrument_name" in body:
            save(db, user.id, request(**body), "NPN.JO", "Technology")
        else:
            save(db, user.id, request(**body))
    db.add(ChatConversation(user_id=user.id, title="chat"))
    db.add(Watchlist(user_id=user.id, ticker="NPN.JO"))
    db.commit()
    return user


def _orphans(db) -> dict:
    found = {}
    for table in Base.metadata.sorted_tables:
        for fk in table.foreign_keys:
            parent = fk.column.table
            if parent.name not in ("users", "portfolios", "documents", "chat_conversations"):
                continue
            column = fk.parent
            missing = db.scalar(
                select(func.count()).select_from(table).where(
                    column.isnot(None), column.not_in(select(fk.column))
                )
            )
            if missing:
                found[f"{table.name}.{column.name}"] = missing
    return found


def test_the_purge_removes_only_expired_guests_and_everything_they_own(fk_session):
    db, _ = fk_session
    past = datetime.now(UTC) - timedelta(hours=1)
    expired = _user(db, "expired@guest.invalid", is_guest=True, guest_expires_at=past)
    live = _user(db, "live@guest.invalid", is_guest=True,
                 guest_expires_at=datetime.now(UTC) + timedelta(hours=1))
    registered = _user(db, "real@example.com", is_guest=False)
    legacy = _user(db, "old@example.com", is_guest=None, guest_expires_at=past)
    db.add(NewsArticle(external_id="a1", source="marketaux", title="t",
                       published_at=datetime.now(UTC)))
    db.commit()
    shared_before = count(db, NewsArticle)
    expired_id, kept = expired.id, {live.id, registered.id, legacy.id}

    assert guest_service.purge_expired_guests(db) == 1
    db.commit()

    remaining = set(db.scalars(select(User.id)))
    assert expired_id not in remaining
    assert kept <= remaining
    assert count(db, Holdings) == 3
    assert count(db, Portfolios) == 3
    assert count(db, Watchlist) == 3
    assert count(db, NewsArticle) == shared_before
    assert _orphans(db) == {}


def test_purging_all_guests_still_never_touches_registered_users(fk_session):
    db, _ = fk_session
    _user(db, "live@guest.invalid", is_guest=True,
          guest_expires_at=datetime.now(UTC) + timedelta(hours=1))
    registered_id = _user(db, "real@example.com", is_guest=None).id

    assert guest_service.purge_expired_guests(db, all_guests=True) == 1
    db.commit()

    assert list(db.scalars(select(User.id))) == [registered_id]
    assert _orphans(db) == {}


def test_the_dry_run_counts_without_deleting(fk_session, monkeypatch):
    db, session_factory = fk_session
    past = datetime.now(UTC) - timedelta(hours=1)
    _user(db, "expired@guest.invalid", is_guest=True, guest_expires_at=past)
    monkeypatch.setattr(purge_guests, "SessionLocal", session_factory)

    assert purge_guests.purge(dry_run=True) == 1
    assert count(db, User) == 1

    assert purge_guests.purge() == 1
    assert count(db, User) == 0
    assert _orphans(db) == {}


def test_a_started_guest_can_be_ended_with_nothing_left_behind(fk_session):
    db, _ = fk_session
    user, _expires = guest_service.start_guest(db)
    guest_service.end_guest(db, user)

    assert count(db, User) == 0
    for model in (Document, Portfolios, *SHEETS):
        assert count(db, model) == 0, model.__name__


def test_ending_a_registered_user_is_refused(fk_session):
    db, _ = fk_session
    registered = _user(db, "real@example.com", is_guest=False)

    with pytest.raises(AppError) as caught:
        guest_service.end_guest(db, registered)

    assert caught.value.status_code == 403
    assert count(db, User) == 1


EMPTY_STATE_ROUTES = [
    ("get", "/api/portfolio"),
    ("get", "/api/portfolio/summary"),
    ("get", "/api/portfolio/health-score"),
    ("get", "/api/portfolio/events"),
    ("get", "/api/import_pdf/my_portfolio"),
    ("get", "/api/explore/recommendations"),
    ("get", "/api/news/portfolio"),
    ("get", "/api/watchlist/"),
    ("post", "/api/ai_chat/"),
]


@pytest.mark.usefixtures("registered")
@pytest.mark.parametrize(("method", "url"), EMPTY_STATE_ROUTES)
def test_a_new_guest_gets_the_same_empty_state_as_a_new_account(client, method, url):
    bedrock = MagicMock()
    bedrock.converse.return_value = {
        "output": {"message": {"content": [{"text": "Import a statement first."}]}}
    }
    extra = {"json": {"message": "How is my portfolio doing?"}} if method == "post" else {}

    with patch("app.services.ai_service.get_bedrock_client", return_value=bedrock), \
         patch("app.routers.ai_chat.run_post_turn"), \
         patch("app.routers.news.requests.get", side_effect=AssertionError("newsdata")), \
         patch("app.services.watchlist.yf.Ticker", side_effect=AssertionError("yahoo")):
        guest = getattr(client, method)(url, headers=guest_headers(start(client)), **extra)
        account = getattr(client, method)(url, headers=bearer(REGISTERED_TOKEN), **extra)

    assert (guest.status_code, account.status_code) == (200, 200), guest.text
