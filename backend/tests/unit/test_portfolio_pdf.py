import base64
import copy
import io
import json
import os
import re
import tempfile
import threading
import zlib
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
from matplotlib.axes import Axes
from PIL import Image

from app.models.portfolio import Holdings, Portfolios
from app.models.user import User
from app.repositories.portfolio_repository import PortfolioRepository
from app.routers import portfolio_snapshot
from app.services import portfolio_brief_dashboard as dashboard
from app.services import portfolio_brief_service as brief
from app.services.pdf_summary_service import get_the_top_allocation_import_PDF

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "portfolio_snapshot_sa_demo.json"
SA_DEMO = json.loads(FIXTURE.read_text(encoding="utf-8"))


@pytest.fixture(autouse=True)
def _clear_news_images():
    brief._news_images.clear()
    yield
    brief._news_images.clear()


class FakeImageResponse:
    def __init__(self, body, headers=None):
        self.body = body
        self.headers = {"Content-Length": str(len(body))} if headers is None else headers
        self.chunks_read = 0

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def raise_for_status(self):
        pass

    def iter_content(self, chunk_size):
        for start in range(0, len(self.body), chunk_size):
            self.chunks_read += 1
            yield self.body[start:start + chunk_size]


def image_bytes(size, mode="RGB", colour=(30, 120, 200), fmt="JPEG"):
    buffer = io.BytesIO()
    Image.new(mode, size, colour).save(buffer, fmt)
    return buffer.getvalue()


@pytest.fixture(scope="module")
def news_jpeg():
    rng = np.random.default_rng(3)
    pixels = rng.integers(0, 256, (900, 1600, 3), dtype=np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(pixels).save(buffer, "JPEG", quality=85)
    return buffer.getvalue()


@pytest.fixture
def news_images(news_jpeg):
    with patch.object(brief.requests, "get",
                      side_effect=lambda *_a, **_k: FakeImageResponse(news_jpeg)) as get:
        yield get


def page_count(pdf):
    return len(re.findall(rb"/Type /Page[^s]", pdf))


def pdf_text(pdf):
    found = []
    for stream in re.findall(rb"stream\r?\n(.*?)endstream", pdf, re.S):
        stream = stream.strip()
        if not stream.endswith(b"~>"):
            continue
        try:
            page = zlib.decompress(base64.a85decode(stream[:-2]))
        except (ValueError, zlib.error):
            continue
        found += re.findall(rb"\(((?:[^()\\]|\\.)*)\) Tj", page)
    return "\n".join(re.sub(rb"\\([()\\])", rb"\1", part).decode("latin-1") for part in found)


def build(snapshot=None, **keywords):
    keywords.setdefault("user_name", "Test User")
    return brief.generate_portfolio_brief(
        portfolio_id="00000000-0000-0000-0000-000000000000",
        snapshot_hash=SA_DEMO["snapshot_hash"],
        snapshot=snapshot or SA_DEMO["snapshot"],
        **keywords,
    ).getvalue()

def test_the_sa_demo_pdf_keeps_its_pages_and_stays_small(news_images, news_jpeg):
    pdf = build()

    assert len(news_jpeg) > 700 * 1024
    assert pdf.startswith(b"%PDF")
    assert page_count(pdf) == 11
    assert len(pdf) < 1024 * 1024
    assert news_images.call_count == 5
    assert len(brief._news_images) == 5

def test_a_non_https_image_is_never_fetched():
    with patch.object(brief.requests, "get") as get:
        assert brief.get_news_image("http://img.example/a.jpg") is None
        assert brief.get_news_image("http://169.254.169.254/latest/meta-data") is None
        assert brief.get_news_image("") is None
        assert brief.get_news_image(None) is None
    get.assert_not_called()


def test_an_image_that_says_it_is_too_big_is_not_read():
    response = FakeImageResponse(b"x" * 10, headers={"Content-Length": str(3 * 1024 * 1024)})
    with patch.object(brief.requests, "get", return_value=response):
        assert brief.get_news_image("https://img.example/big.jpg") is None
    assert response.chunks_read == 0


def test_a_streamed_image_stops_once_it_passes_2_mb():
    response = FakeImageResponse(b"\0" * (3 * 1024 * 1024), headers={})
    with patch.object(brief.requests, "get", return_value=response):
        assert brief.get_news_image("https://img.example/endless.jpg") is None
    assert response.chunks_read == 33


def test_a_huge_image_comes_back_as_a_540_by_360_jpeg():
    body = image_bytes((6000, 4000))
    with patch.object(brief.requests, "get", return_value=FakeImageResponse(body)):
        result = brief.get_news_image("https://img.example/huge.jpg")

    image = Image.open(result)
    assert image.format == "JPEG"
    assert image.size == (540, 360)


def test_a_transparent_png_is_flattened_onto_white():
    body = image_bytes((40, 20), mode="RGBA", colour=(255, 0, 0, 0), fmt="PNG")
    with patch.object(brief.requests, "get", return_value=FakeImageResponse(body)):
        result = brief.get_news_image("https://img.example/logo.png")

    image = Image.open(result)
    assert image.format == "JPEG"
    assert image.mode == "RGB"
    assert image.size == (40, 20)
    assert min(image.getpixel((20, 10))) >= 250


def test_a_failed_fetch_returns_none():
    with patch.object(brief.requests, "get", side_effect=brief.requests.ConnectionError("down")):
        assert brief.get_news_image("https://img.example/a.jpg") is None


def test_a_body_that_is_not_an_image_returns_none():
    with patch.object(brief.requests, "get", return_value=FakeImageResponse(b"<html>nope</html>")):
        assert brief.get_news_image("https://img.example/a.jpg") is None


def test_the_same_image_is_fetched_once_and_each_caller_gets_its_own_buffer():
    body = image_bytes((300, 200))
    with patch.object(brief.requests, "get", return_value=FakeImageResponse(body)) as get:
        first = brief.get_news_image("https://img.example/a.jpg")
        first.read()
        second = brief.get_news_image("https://img.example/a.jpg")

    assert get.call_count == 1
    assert second is not first
    assert second.tell() == 0
    assert second.getvalue() == first.getvalue()


def test_a_failure_is_not_cached():
    body = image_bytes((300, 200))
    with patch.object(brief.requests, "get",
                      side_effect=[brief.requests.Timeout("slow"), FakeImageResponse(body)]) as get:
        assert brief.get_news_image("https://img.example/a.jpg") is None
        assert brief.get_news_image("https://img.example/a.jpg") is not None
    assert get.call_count == 2


def test_the_image_cache_keeps_the_newest_32():
    body = image_bytes((30, 20))
    with patch.object(brief.requests, "get", side_effect=lambda *_a, **_k: FakeImageResponse(body)):
        for number in range(33):
            brief.get_news_image(f"https://img.example/{number}.jpg")

    assert len(brief._news_images) == 32
    assert "https://img.example/0.jpg" not in brief._news_images
    assert "https://img.example/32.jpg" in brief._news_images

snapshot = SA_DEMO["snapshot"]
CHARTS = {
    "cash_flow": lambda: brief.create_cash_flow_chart(snapshot["activity"]["cash_flow"]),
    "allocation": lambda: brief.create_allocation_chart(snapshot["holdings"]["allocation"]),
    "trading": lambda: brief.create_trading_chart(snapshot["activity"]["trading"]),
    "dividend": lambda: brief.create_dividend_chart(snapshot["activity"]["dividend_income"]),
    "performance": lambda: dashboard._performance_chart(
        snapshot["dashboard"]["performanceHistory"], snapshot["dashboard"].get("benchmarkLabel")
    ),
    "sector": lambda: dashboard._sector_chart(snapshot["dashboard"]["sectorAllocation"]),
    "subscore": lambda: dashboard._subscore_chart(snapshot["dashboard"]["health"]["subscores"]),
    "holdings": lambda: dashboard._holdings_chart(snapshot["drivers"]["holdings"])[0],
}


@pytest.mark.parametrize("name", CHARTS)
def test_a_chart_is_the_same_on_8_threads_as_on_one(name):
    draw = CHARTS[name]
    single = draw().getvalue()
    results = [None] * 8

    def one(slot):
        results[slot] = draw().getvalue()

    threads = [threading.Thread(target=one, args=(slot,)) for slot in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert single.startswith(b"\x89PNG")
    assert results == [single] * 8

@pytest.mark.parametrize("weights", [[0.0, 0.0], [float("nan"), 50.0]])
def test_an_allocation_without_weights_still_draws(weights):
    allocation = [{"name": f"Holding {i}", "weight_percentage": w} for i, w in enumerate(weights)]

    assert brief.create_allocation_chart(allocation).getvalue().startswith(b"\x89PNG")


def test_null_weights_from_the_database_still_draw(db_session, test_user):
    portfolio = Portfolios(user_id=test_user.id, portfolio_name="Growth", account_number="ACC-1")
    db_session.add(portfolio)
    db_session.flush()
    db_session.add_all([
        Holdings(portfolio_id=portfolio.id, instrument_name="Naspers", weight_percentage=None),
        Holdings(portfolio_id=portfolio.id, instrument_name="MTN", weight_percentage=None),
    ])
    db_session.commit()

    allocation = get_the_top_allocation_import_PDF(db_session, portfolio.id, test_user.id)

    assert [row["weight_percentage"] for row in allocation] == [0.0, 0.0]
    assert brief.create_allocation_chart(allocation).getvalue().startswith(b"\x89PNG")

def portfolio_with_snapshot(db_session, user, snapshot_data=None):
    portfolio = Portfolios(user_id=user.id, portfolio_name="Growth", account_number="ACC-1")
    db_session.add(portfolio)
    db_session.commit()
    if snapshot_data is not False:
        PortfolioRepository(db_session).save_canonical_snapshot(
            portfolio.id, SA_DEMO["snapshot_hash"], snapshot_data or SA_DEMO["snapshot"]
        )
    return portfolio.id


def download_url(portfolio_id):
    return f"/api/portfolio_snapshot/{portfolio_id}/download"


@pytest.fixture
def fake_pdf():
    with patch.object(portfolio_snapshot, "generate_portfolio_brief",
                      side_effect=lambda **_kwargs: io.BytesIO(b"%PDF-1.4 test")) as builder:
        yield builder


@pytest.mark.usefixtures("news_images")
def test_the_download_sends_the_whole_pdf_once(client, db_session, test_user, auth_headers):
    portfolio_id = portfolio_with_snapshot(db_session, test_user)

    response = client.get(download_url(portfolio_id), headers=auth_headers)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert int(response.headers["content-length"]) == len(response.content)
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["content-disposition"] == (
        "attachment; filename=\"Equity-lens-Test User.pdf\"; "
        "filename*=UTF-8''Equity-lens-Test%20User.pdf"
    )
    assert response.content.startswith(b"%PDF")
    assert page_count(response.content) == 11


def test_a_name_outside_latin_1_still_downloads(client, db_session, test_user, auth_headers,
                                               fake_pdf):
    test_user.full_name = "Zoë 李"
    db_session.commit()
    portfolio_id = portfolio_with_snapshot(db_session, test_user)

    response = client.get(download_url(portfolio_id), headers=auth_headers)

    assert response.status_code == 200
    assert fake_pdf.call_count == 1
    assert response.headers["content-disposition"] == (
        "attachment; filename=\"Equity-lens-Zo_ _.pdf\"; "
        "filename*=UTF-8''Equity-lens-Zo%C3%AB%20%E6%9D%8E.pdf"
    )


def test_someone_elses_portfolio_is_not_found(client, db_session, auth_headers, fake_pdf):
    other = User(email="other@example.com", full_name="Other", cognito_sub="other-sub",
                 is_active=True)
    db_session.add(other)
    db_session.commit()
    portfolio_id = portfolio_with_snapshot(db_session, other)

    response = client.get(download_url(portfolio_id), headers=auth_headers)

    assert response.status_code == 404
    fake_pdf.assert_not_called()


def test_a_portfolio_without_a_snapshot_is_not_found(client, db_session, test_user,
                                                    auth_headers, fake_pdf):
    portfolio_id = portfolio_with_snapshot(db_session, test_user, snapshot_data=False)

    response = client.get(download_url(portfolio_id), headers=auth_headers)

    assert response.status_code == 404
    fake_pdf.assert_not_called()


@pytest.mark.usefixtures("news_images")
def test_an_empty_allocation_downloads(client, db_session, test_user, auth_headers):
    empty = copy.deepcopy(SA_DEMO["snapshot"])
    for row in empty["holdings"]["allocation"]:
        row["weight_percentage"] = 0.0
    portfolio_id = portfolio_with_snapshot(db_session, test_user, empty)

    response = client.get(download_url(portfolio_id), headers=auth_headers)

    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")


def test_a_failed_build_is_a_500_with_a_code(client, db_session, test_user, auth_headers):
    portfolio_id = portfolio_with_snapshot(db_session, test_user)

    with patch.object(portfolio_snapshot, "generate_portfolio_brief",
                      side_effect=RuntimeError("reportlab fell over")):
        response = client.get(download_url(portfolio_id), headers=auth_headers)

    assert response.status_code == 500
    assert response.json()["error_code"] == "PDF_GENERATION_FAILED"


def test_running_out_of_memory_is_a_busy_503(client, db_session, test_user, auth_headers):
    portfolio_id = portfolio_with_snapshot(db_session, test_user)

    with patch.object(portfolio_snapshot, "generate_portfolio_brief", side_effect=MemoryError):
        response = client.get(download_url(portfolio_id), headers=auth_headers)

    assert response.status_code == 503
    assert response.json()["error_code"] == "PDF_BUSY"
    assert response.headers["Retry-After"] == "5"


def get_in_threads(client, url, headers, count):
    responses = [None] * count

    def one(slot):
        responses[slot] = client.get(url, headers=headers)

    threads = [threading.Thread(target=one, args=(slot,)) for slot in range(count)]
    for thread in threads:
        thread.start()
    return threads, responses


def test_two_builds_still_run_together_after_five_failures(client, db_session, test_user,
                                                           auth_headers):
    portfolio_id = portfolio_with_snapshot(db_session, test_user)
    with patch.object(portfolio_snapshot, "generate_portfolio_brief",
                      side_effect=RuntimeError("reportlab fell over")):
        for _ in range(5):
            assert client.get(download_url(portfolio_id), headers=auth_headers).status_code == 500

    both_building = threading.Barrier(2, timeout=10)

    def build_together(**_kwargs):
        both_building.wait()
        return io.BytesIO(b"%PDF-1.4 test")

    with patch.object(portfolio_snapshot, "generate_portfolio_brief", side_effect=build_together):
        threads, responses = get_in_threads(client, download_url(portfolio_id), auth_headers, 2)
        for thread in threads:
            thread.join(timeout=15)

    assert [r.status_code for r in responses] == [200, 200]


def test_a_third_download_waits_then_gets_busy(client, db_session, test_user, auth_headers,
                                               monkeypatch):
    portfolio_id = portfolio_with_snapshot(db_session, test_user)
    monkeypatch.setattr(portfolio_snapshot, "PDF_SLOT_TIMEOUT_SECONDS", 0.05)
    started = threading.Semaphore(0)
    release = threading.Event()
    worker_names = []

    def slow_build(**_kwargs):
        worker_names.append(threading.current_thread().name)
        started.release()
        release.wait(timeout=10)
        return io.BytesIO(b"%PDF-1.4 test")

    with patch.object(portfolio_snapshot, "generate_portfolio_brief", side_effect=slow_build):
        threads, responses = get_in_threads(client, download_url(portfolio_id), auth_headers, 2)
        try:
            assert started.acquire(timeout=10)
            assert started.acquire(timeout=10)
            busy = client.get(download_url(portfolio_id), headers=auth_headers)
        finally:
            release.set()
            for thread in threads:
                thread.join(timeout=15)
        after = client.get(download_url(portfolio_id), headers=auth_headers)

    assert busy.status_code == 503
    assert busy.json()["error_code"] == "PDF_BUSY"
    assert busy.headers["Retry-After"] == "5"
    assert [r.status_code for r in responses] == [200, 200]
    assert after.status_code == 200
    assert all(name.startswith("pdf") for name in worker_names)


@pytest.mark.usefixtures("news_images")
def test_a_download_leaves_no_temp_files(client, db_session, test_user, auth_headers):
    portfolio_id = portfolio_with_snapshot(db_session, test_user)
    before = set(os.listdir(tempfile.gettempdir()))

    response = client.get(download_url(portfolio_id), headers=auth_headers)

    assert response.status_code == 200
    assert set(os.listdir(tempfile.gettempdir())) == before

def snapshot_copy():
    return copy.deepcopy(SA_DEMO["snapshot"])


def test_the_cover_no_longer_uses_the_stretched_jpg():
    source = Path(brief.__file__).read_text(encoding="utf-8")

    assert "front_page.jpg" not in source
    assert brief.LOGO_PATH.exists()


def test_the_header_logo_is_at_least_600_pixels_wide():
    with Image.open(brief.LOGO_PATH) as logo:
        assert logo.width >= 600


@pytest.mark.usefixtures("news_images")
def test_the_footer_numbers_every_page_and_shows_the_short_snapshot_id():
    text = pdf_text(build())

    assert "Page 2 of 11" in text
    assert "Page 11 of 11" in text
    assert SA_DEMO["snapshot_hash"][:12] in text
    assert SA_DEMO["snapshot_hash"] not in text


@pytest.mark.usefixtures("news_images")
def test_an_older_snapshot_without_statement_value_shows_the_cost_basis():
    assert "StatementValue" not in SA_DEMO["snapshot"]["summary"]

    text = pdf_text(build())

    assert "Cost basis" in text
    assert "Value at statement date" not in text


@pytest.mark.usefixtures("news_images")
def test_a_snapshot_with_statement_value_labels_it():
    snapshot = snapshot_copy()
    snapshot["summary"].update(
        StatementValue=250000.5, StatementDate="2026-09-29", ValueBasis="statement"
    )

    text = pdf_text(build(snapshot))

    assert "Value at statement date" in text
    assert "R 250,000.50" in text
    assert "Value today (live prices)" in text


@pytest.mark.usefixtures("news_images")
def test_the_new_keywords_reach_the_page():
    text = pdf_text(build(
        portfolio_name="Growth Fund", statement_date="2026-09-29", account_last4="5678"
    ))

    assert "Growth Fund" in text
    assert "ending 5678" in text
    assert "29 Sep 2026" in text


@pytest.mark.usefixtures("news_images")
def test_leaving_the_new_keywords_out_still_builds():
    text = pdf_text(build())

    assert "Not named" in text
    assert "ending" not in text
    assert "29 Sep 2026" in text


@pytest.mark.usefixtures("news_images")
def test_no_user_name_still_builds():
    pdf = build(user_name=None)

    assert pdf.startswith(b"%PDF")
    assert "Prepared for" not in pdf_text(pdf)


def test_news_without_images_spans_the_row():
    with patch.object(brief.requests, "get", side_effect=brief.requests.ConnectionError("down")):
        pdf = build()

    assert pdf.startswith(b"%PDF")
    assert "Image unaviable" not in pdf_text(pdf)
    assert "Market headline 0" in pdf_text(pdf)


@pytest.mark.usefixtures("news_images")
def test_no_dividends_and_one_holding_still_build():
    snapshot = snapshot_copy()
    snapshot["activity"]["dividend_income"] = []
    for key in ("top", "allocation"):
        snapshot["holdings"][key] = snapshot["holdings"][key][:1]
    snapshot["analytics"] = snapshot["analytics"][:1]
    snapshot["dashboard"]["holdings"] = snapshot["dashboard"]["holdings"][:1]
    snapshot["dashboard"]["sectorAllocation"] = snapshot["dashboard"]["sectorAllocation"][:1]

    text = pdf_text(build(snapshot))

    assert "No dividends in this statement." in text
    assert "Dividend Income" in text


@pytest.mark.usefixtures("news_images")
def test_analytics_columns_that_are_all_na_are_dropped():
    text = pdf_text(build())

    assert "Altman Z" not in text
    assert "P/E" not in text
    assert "Sortino" in text


def test_a_late_benchmark_start_is_noted():
    history = copy.deepcopy(SA_DEMO["snapshot"]["dashboard"]["performanceHistory"])
    for point in history[:30]:
        point["benchmark"] = None

    note = dashboard._benchmark_note(history, "Satrix 40")

    assert "Dashed line: Satrix 40." in note
    assert "Benchmark data starts on" in note
    assert "Benchmark data starts" not in dashboard._benchmark_note(
        SA_DEMO["snapshot"]["dashboard"]["performanceHistory"], "Satrix 40"
    )


def dashed_line(history):
    drawn = []
    real_plot = Axes.plot

    def spy(ax, *args, **kwargs):
        drawn.append((args, kwargs))
        return real_plot(ax, *args, **kwargs)

    with patch.object(Axes, "plot", spy):
        dashboard._performance_chart(history, "Satrix 40")
    dashed = [(args[1], kwargs["label"]) for args, kwargs in drawn
              if kwargs.get("linestyle") == "--"]
    return dashed[0]


def with_mirror(history):
    return [
        {**point, "net_flow": 0.0, "benchmark_mirror": point["benchmark"] + 100,
         "mirror_exhausted": False}
        for point in history
    ]


@pytest.mark.usefixtures("news_images")
def test_the_pdf_draws_the_same_money_line_when_the_snapshot_has_it():
    snapshot = copy.deepcopy(SA_DEMO["snapshot"])
    history = with_mirror(snapshot["dashboard"]["performanceHistory"])
    snapshot["dashboard"]["performanceHistory"] = history

    values, label = dashed_line(history)
    text = pdf_text(build(snapshot))

    assert values == [point["benchmark_mirror"] for point in history]
    assert label == "Same money in Satrix 40"
    assert "the same money invested in Satrix 40 (JSE Top 40 proxy) on the same days." in text


@pytest.mark.usefixtures("news_images")
def test_an_older_snapshot_keeps_the_rebased_benchmark_line():
    history = SA_DEMO["snapshot"]["dashboard"]["performanceHistory"]

    values, label = dashed_line(history)
    text = pdf_text(build())

    assert values == [point["benchmark"] for point in history]
    assert label == "Satrix 40"
    assert "Dashed line: Satrix 40 (JSE Top 40 proxy)." in text
    assert "same money" not in text


@pytest.mark.parametrize("count", [5, 7])
def test_a_pie_or_its_bars_draw(count):
    allocation = [{"name": f"Holding {i}", "weight_percentage": 10.0 + i} for i in range(count)]

    assert brief.create_allocation_chart(allocation).getvalue().startswith(b"\x89PNG")


@pytest.mark.usefixtures("news_images")
def test_the_account_number_never_appears_in_full(client, db_session, test_user, auth_headers):
    portfolio_id = portfolio_with_snapshot(db_session, test_user)
    portfolio = db_session.get(Portfolios, portfolio_id)
    portfolio.account_number = "EE-12345678"
    db_session.commit()

    with patch.object(portfolio_snapshot, "generate_portfolio_brief",
                      wraps=brief.generate_portfolio_brief) as builder:
        response = client.get(download_url(portfolio_id), headers=auth_headers)

    assert response.status_code == 200
    assert builder.call_args.kwargs["account_last4"] == "5678"
    assert "EE-12345678" not in builder.call_args.kwargs.values()
    text = pdf_text(response.content)
    assert "ending 5678" in text
    assert "12345678" not in text
    assert "Growth" in text