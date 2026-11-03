from app.calendar_engine import (
    format_parana_for_city,
    get_calendar_month,
    get_city_by_id,
    parse_vaishnava_ics,
)


def test_november_2026_returns_canonical_gaurabda_540_events():
    res = get_calendar_month(2026, 11, "nyc", reference_date="2026-11-02")
    assert res.year == 2026
    assert res.month == 11
    assert res.city.id == "nyc"
    assert len(res.events) == 30
    assert res.events[0].date == "2026-11-01"
    assert res.events[0].type == "ekadashi"
    assert "Rama Ekadashi" in (res.events[0].festival or "")
    assert res.events[1].date == "2026-11-02"
    assert res.events[1].paranaWindow == "06:24 – 10:18 (New York)"
    assert res.nextEkadashi.date == "2026-11-16"


def test_format_parana_for_city_wraps_midnight():
    mayapur = get_city_by_id("may")  # paranaShiftMinutes = -35
    shifted = format_parana_for_city(("00:15", "09:00"), mayapur)
    assert shifted == "23:40 – 08:25 (Sri Mayapur Candrodaya Mandir)"


def test_algorithmic_month_generates_ekadashi_and_parana_pairs():
    res = get_calendar_month(2026, 12, "lon")
    assert len(res.events) == 31
    ekadashis = [e for e in res.events if e.type == "ekadashi"]
    paranas = [e for e in res.events if e.type == "parana"]
    assert len(ekadashis) >= 2
    assert len(paranas) >= 1
    assert all("London" in (p.paranaWindow or "") for p in paranas)


def test_parse_vaishnava_ics_extracts_vevents_and_classifies_types():
    sample_ics = (
        "BEGIN:VCALENDAR\n"
        "BEGIN:VEVENT\n"
        "DTSTART;VALUE=DATE:20261211\n"
        "SUMMARY:Moksada Ekadashi\\, Fast\n"
        "DESCRIPTION:Complete fast from grains\\nObserve Gita Jayanti\n"
        "END:VEVENT\n"
        "BEGIN:VEVENT\n"
        "DTSTART:20261212\n"
        "SUMMARY:Break fast (Parana)\n"
        "DESCRIPTION:Parana window\n"
        "END:VEVENT\n"
        "END:VCALENDAR"
    )
    events = parse_vaishnava_ics(sample_ics, city_id="nyc")
    assert len(events) == 2
    assert events[0].date == "2026-12-11"
    assert events[0].type == "ekadashi"
    assert events[0].festival == "Moksada Ekadashi, Fast"
    assert events[1].date == "2026-12-12"
    assert events[1].type == "parana"
    assert events[1].paranaWindow == "06:30 – 10:15 (New York)"
