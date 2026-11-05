from pathlib import Path
import httpx
from fastapi.testclient import TestClient
from app.main import app, create_app, resolve_static_file
from app.youtube_resolver import extract_youtube_id, resolve_youtube_metadata

client = TestClient(app)


def test_health_and_cities_endpoints():
    r_health = client.get("/api/health")
    assert r_health.status_code == 200
    assert r_health.json() == {"status": "ok", "service": "sadhana-valli-api"}

    r_cities = client.get("/api/cities")
    assert r_cities.status_code == 200
    cities = r_cities.json()["cities"]
    assert len(cities) == 6
    assert cities[0]["id"] == "nyc"


def test_get_calendar_endpoint_and_rejects_out_of_range_params():
    ok = client.get("/api/calendar?year=2026&month=11&city_id=may")
    assert ok.status_code == 200
    body = ok.json()
    assert body["city"]["id"] == "may"
    assert len(body["events"]) == 30

    fallback_city = client.get("/api/calendar?year=2026&month=11&city_id=unknown_temple")
    assert fallback_city.status_code == 200
    assert fallback_city.json()["city"]["id"] == "nyc"

    bad_month = client.get("/api/calendar?year=2026&month=13")
    assert bad_month.status_code == 422

    bad_year = client.get("/api/calendar?year=1999&month=11")
    assert bad_year.status_code == 422


def test_import_ics_endpoint_and_rejects_empty_or_invalid_payload():
    bad = client.post("/api/calendar/import-ics", json={"icsText": "not an ics file", "cityId": "nyc"})
    assert bad.status_code == 422

    valid_ics = (
        "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261116\n"
        "SUMMARY:Utthana Ekadashi\nEND:VEVENT\nEND:VCALENDAR"
    )
    good = client.post("/api/calendar/import-ics", json={"icsText": valid_ics, "cityId": "nyc"})
    assert good.status_code == 200
    assert good.json()["importedCount"] == 1


def test_extract_youtube_id_and_reject_invalid():
    assert extract_youtube_id("https://www.youtube.com/watch?v=fbm_O3pD_3c") == "fbm_O3pD_3c"
    assert extract_youtube_id("https://youtu.be/kR8BfG8D1qU?t=12") == "kR8BfG8D1qU"
    assert extract_youtube_id("v7w5N7w9K2c") == "v7w5N7w9K2c"
    assert extract_youtube_id("https://example.com/not-youtube") is None
    assert extract_youtube_id("https://www.youtube.com/shorts/fbm_O3pD_3c") == "fbm_O3pD_3c"
    assert extract_youtube_id("https://www.youtube.com/embed/fbm_O3pD_3c") == "fbm_O3pD_3c"
    assert extract_youtube_id("https://www.youtube.com/live/fbm_O3pD_3c") == "fbm_O3pD_3c"
    assert extract_youtube_id("https://[invalid") is None

    bad_resp = client.get("/api/youtube/resolve?url=not-a-valid-url")
    assert bad_resp.status_code == 422


def test_resolve_youtube_survives_upstream_failure():
    def failing_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("Simulated timeout")

    mock_client = httpx.Client(transport=httpx.MockTransport(failing_handler))
    resolved = resolve_youtube_metadata("https://youtu.be/fbm_O3pD_3c", client=mock_client)
    assert resolved.youtubeId == "fbm_O3pD_3c"
    assert resolved.thumbnailUrl == "https://i.ytimg.com/vi/fbm_O3pD_3c/hqdefault.jpg"
    assert resolved.title == "ISKCON Srimad-Bhagavatam Class"
    assert resolved.speaker == "Vaishnava Speaker"


def test_resolve_youtube_happy_path_and_blank_field_fallback():
    def success_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "title": "  Bhagavad-gita 9.14 Lecture  ",
                "author_name": "Srila Prabhupada",
            },
        )

    ok_client = httpx.Client(transport=httpx.MockTransport(success_handler))
    resolved = resolve_youtube_metadata("https://www.youtube.com/watch?v=fbm_O3pD_3c", client=ok_client)
    assert resolved.youtubeId == "fbm_O3pD_3c"
    assert resolved.title == "Bhagavad-gita 9.14 Lecture"
    assert resolved.speaker == "Srila Prabhupada"

    def blank_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"title": "   ", "author_name": ""})

    blank_client = httpx.Client(transport=httpx.MockTransport(blank_handler))
    fallback = resolve_youtube_metadata("fbm_O3pD_3c", client=blank_client)
    assert fallback.title == "ISKCON Srimad-Bhagavatam Class"
    assert fallback.speaker == "Vaishnava Speaker"


def test_serves_spa_frontend_when_static_dir_exists(tmp_path: Path):
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>Sadhana Valli</title>", encoding="utf-8")
    (assets_dir / "app.js").write_text("console.log('sadhana');", encoding="utf-8")

    spa_client = TestClient(create_app(static_dir=tmp_path))

    root_resp = spa_client.get("/")
    assert root_resp.status_code == 200
    assert "Sadhana Valli" in root_resp.text

    asset_resp = spa_client.get("/assets/app.js")
    assert asset_resp.status_code == 200
    assert "console.log('sadhana');" in asset_resp.text

    api_resp = spa_client.get("/api/health")
    assert api_resp.status_code == 200
    assert api_resp.json() == {"status": "ok", "service": "sadhana-valli-api"}


def test_resolve_static_file_rejects_parent_traversal(tmp_path: Path):
    root = tmp_path / "dist"
    root.mkdir()
    (root / "sw.js").write_text("/* sw */", encoding="utf-8")
    secret = tmp_path / "secret.txt"
    secret.write_text("nope", encoding="utf-8")

    assert resolve_static_file(root, "sw.js") == (root / "sw.js").resolve()
    assert resolve_static_file(root, "../secret.txt") is None
    assert resolve_static_file(root, "foo/../../secret.txt") is None
    assert resolve_static_file(root, "missing.js") is None


def test_serves_pwa_files_and_leaves_api_alone(tmp_path: Path):
    (tmp_path / "index.html").write_text("<!doctype html><title>Sadhana Valli</title>", encoding="utf-8")
    (tmp_path / "manifest.webmanifest").write_text('{"name":"Sadhana Valli"}', encoding="utf-8")
    (tmp_path / "sw.js").write_text("/* sw */", encoding="utf-8")
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log('sadhana');", encoding="utf-8")

    spa_client = TestClient(create_app(static_dir=tmp_path))

    manifest = spa_client.get("/manifest.webmanifest")
    assert manifest.status_code == 200
    assert manifest.headers["content-type"].startswith("application/manifest+json")
    assert manifest.json()["name"] == "Sadhana Valli"

    sw = spa_client.get("/sw.js")
    assert sw.status_code == 200
    assert "/* sw */" in sw.text

    missing = spa_client.get("/sw-missing.js")
    assert missing.status_code == 404
    assert "Sadhana Valli" not in missing.text

    health = spa_client.get("/api/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok", "service": "sadhana-valli-api"}

    asset = spa_client.get("/assets/app.js")
    assert asset.status_code == 200
    assert "console.log('sadhana');" in asset.text


