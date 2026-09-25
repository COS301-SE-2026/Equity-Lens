from starlette.requests import Request

from app.config import settings
from app.main import general_exception_handler


def build_request(origin: str | None = None) -> Request:
    headers = [(b"origin", origin.encode())] if origin else []
    return Request({"type": "http", "method": "GET", "path": "/api/health", "headers": headers})


async def test_500_echoes_cors_headers_for_an_allowed_origin():
    origin = settings.cors_origins[0]

    response = await general_exception_handler(build_request(origin), RuntimeError("boom"))

    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"


async def test_500_does_not_echo_an_origin_we_do_not_allow():
    response = await general_exception_handler(
        build_request("https://not-equitylens.example"), RuntimeError("boom")
    )

    assert "access-control-allow-origin" not in response.headers


async def test_500_without_an_origin_header_is_unchanged():
    response = await general_exception_handler(build_request(), RuntimeError("boom"))

    assert "access-control-allow-origin" not in response.headers


def test_health_auth_reports_booleans_only(client):
    body = client.get("/health/auth").json()

    assert set(body) == {"pool_id_configured", "client_id_configured", "jwks_reachable"}
    assert all(isinstance(v, bool) for v in body.values())
