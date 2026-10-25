"""Guest mode against a real postgres: the advisory locks, real ON DELETE CASCADE, and the
routes that bind ids as text. Skipped unless DATABASE_URL points at postgres (CI does)."""
import os
import threading
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select

from app.config import settings
from app.database import Base, SessionLocal
from app.main import app
from app.models.portfolio import Holdings, Portfolios
from app.models.user import User
from app.schemas.responses import AppError
from app.services import guest_service
from app.utils import ai_rate_limit

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL", "").startswith("postgresql"), reason="needs postgres"
)

GUEST_SECRET = "guest-secret-for-tests-only-0123456789"
PARENTS = ("users", "portfolios", "documents", "chat_conversations")


@pytest.fixture(autouse=True)
def guest_mode(monkeypatch):
    monkeypatch.setattr(settings, "guest_mode_enabled", True)
    monkeypatch.setattr(settings, "guest_token_secret", GUEST_SECRET)
    ai_rate_limit._HITS.clear()
    yield
    ai_rate_limit._HITS.clear()


@pytest.fixture
def created():
    ids: list[UUID] = []
    yield ids
    db = SessionLocal()
    try:
        for user_id in ids:
            db.query(User).filter(User.id == user_id, User.is_guest.is_(True)).delete()
        db.commit()
    finally:
        db.close()


def _orphans(db) -> dict:
    existing = set(inspect(db.get_bind()).get_table_names())
    found = {}
    for table in Base.metadata.sorted_tables:
        if table.name not in existing:
            continue
        for fk in table.foreign_keys:
            if fk.column.table.name not in PARENTS:
                continue
            missing = db.scalar(
                select(func.count()).select_from(table).where(
                    fk.parent.isnot(None), fk.parent.not_in(select(fk.column))
                )
            )
            if missing:
                found[f"{table.name}.{fk.parent.name}"] = missing
    return found


def test_twenty_starts_at_once_fill_the_cap_and_no_more(monkeypatch, created):
    db = SessionLocal()
    already = db.scalar(
        select(func.count(User.id)).where(
            User.is_guest.is_(True), User.guest_expires_at > func.now()
        )
    )
    db.close()
    monkeypatch.setattr(settings, "guest_max_active", already + 10)

    started, refused, errors = [], [], []
    gate = threading.Barrier(20)

    def start_one():
        session = SessionLocal()
        try:
            gate.wait()
            user, _ = guest_service.start_guest(session)
            started.append(user.id)
        except AppError as exc:
            refused.append(exc.error_code)
        except Exception as exc:
            errors.append(repr(exc))
        finally:
            session.close()

    threads = [threading.Thread(target=start_one) for _ in range(20)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    created.extend(started)

    assert errors == []
    assert len(started) == 10
    assert refused == ["GUEST_CAPACITY"] * 10

    db = SessionLocal()
    try:
        portfolios = db.scalar(
            select(func.count(Portfolios.id)).where(Portfolios.user_id.in_(started))
        )
        assert portfolios == 0
    finally:
        db.close()


def test_two_purges_at_once_do_not_fail(created):
    db = SessionLocal()
    user, _ = guest_service.start_guest(db)
    created.append(user.id)
    db.close()

    errors = []

    def purge_once():
        session = SessionLocal()
        try:
            guest_service.purge_expired_guests(session)
            session.commit()
        except Exception as exc:
            errors.append(repr(exc))
        finally:
            session.close()

    threads = [threading.Thread(target=purge_once) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []


def test_ending_a_guest_cascades_through_every_table(created):
    client = TestClient(app)
    session = _start(client, "10.1.0.5")
    user_id = UUID(session["user"]["id"])
    created.append(user_id)
    assert _import(client, session).status_code == 200

    ended = client.delete("/api/auth/guest", headers=_headers(session))

    assert ended.status_code == 200
    db = SessionLocal()
    try:
        assert db.get(User, user_id) is None
        left = select(func.count(Portfolios.id)).where(Portfolios.user_id == user_id)
        assert db.scalar(left) == 0
        assert _orphans(db) == {}
    finally:
        db.close()


def _start(client, ip):
    response = client.post("/api/auth/guest", headers={"X-Real-IP": ip})
    assert response.status_code == 201, response.text
    return response.json()


def _headers(session):
    return {"Authorization": f"Bearer {session['access_token']}"}


def _import(client, session, name="mine"):
    document = client.post("/api/import_pdf/", json={"file_name": "statement.xlsx"},
                           headers=_headers(session))
    portfolio = client.post(
        "/api/import_pdf/save_portfolios",
        json={
            "document_id": document.json()["document_id"],
            "account_number": "1",
            "portfolio_name": name,
            "statement_end_date": "2026-09-29",
            "account_type": "zar",
        },
        headers=_headers(session),
    )
    if portfolio.status_code != 200:
        return portfolio
    portfolio_id = portfolio.json()["portfolio_id"]
    holding = client.post(
        "/api/import_pdf/save_holdings",
        json={
            "portfolio_id": portfolio_id, "instrument_name": "Naspers Limited", "ticker": " ",
            "sector": " ", "quantity": 1, "total_cost": 100, "cost_price": 100,
            "weight_percentage": 100,
        },
        headers=_headers(session),
    )
    assert holding.status_code == 200, holding.text
    return portfolio


def test_a_guest_imports_a_statement_through_every_endpoint(created):
    client = TestClient(app)
    session = _start(client, "10.1.0.4")
    created.append(UUID(session["user"]["id"]))

    portfolio = _import(client, session)

    assert portfolio.status_code == 200
    db = SessionLocal()
    try:
        holding = db.scalars(
            select(Holdings).where(Holdings.portfolio_id == UUID(portfolio.json()["portfolio_id"]))
        ).one()
        assert (holding.ticker, holding.sector) == ("NPN.JO", "Technology")
    finally:
        db.close()


def test_the_summary_routes_refuse_another_guests_portfolio(created):
    client = TestClient(app)
    a = _start(client, "10.1.0.1")
    b = _start(client, "10.1.0.2")
    created.extend(UUID(s["user"]["id"]) for s in (a, b))
    portfolio_id = _import(client, a).json()["portfolio_id"]

    for section in ("summary", "top_holdings", "lowest_holdings", "cash_flow", "dividend_income"):
        url = f"/api/import_pdf_summary/{section}/{portfolio_id}"
        assert client.get(url, headers=_headers(a)).status_code == 200, url
        assert client.get(url, headers=_headers(b)).status_code == 404, url


def test_a_guest_cannot_import_a_fourth_portfolio(created):
    client = TestClient(app)
    session = _start(client, "10.1.0.3")
    created.append(UUID(session["user"]["id"]))

    for _ in range(3):
        assert _import(client, session).status_code == 200
    fourth = _import(client, session)
    assert fourth.status_code == 403
    assert fourth.json()["error_code"] == "GUEST_LIMIT"
