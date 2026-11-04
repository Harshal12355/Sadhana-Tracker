import httpx
from fastapi.testclient import TestClient
from app.main import app
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

