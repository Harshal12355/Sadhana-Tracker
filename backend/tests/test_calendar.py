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


def test_unknown_city_falls_back_to_nyc():
    assert get_city_by_id("unknown").id == "nyc"


def test_dec_1_2026_is_parana_after_nov_30_ekadashi():
    res = get_calendar_month(2026, 12, "lon")
    assert res.events[0].type == "parana"
    assert res.events[0].tithi == "Dvadashi"
    assert res.events[0].paksha == "Krsna"
    assert res.events[0].paranaBaseWindow == ("06:30", "10:15")
    assert res.events[0].paranaWindow == "06:52 – 10:37 (London)"


def test_oct_31_2026_is_dashami_before_nov_1_ekadashi():
    res = get_calendar_month(2026, 10, "nyc", reference_date="2026-10-31")
    assert res.events[-1].date == "2026-10-31"
    assert res.events[-1].tithi == "Dashami"
    assert res.events[-1].type == "regular"
    assert res.nextEkadashi.date == "2026-11-01"
    ekadashi_dates = [e.date for e in res.events if e.type == "ekadashi"]
    assert "2026-10-30" not in ekadashi_dates and "2026-10-31" not in ekadashi_dates


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


def test_parse_vaishnava_ics_ignores_valarm_description():
    ics = (
        "BEGIN:VCALENDAR\n"
        "BEGIN:VEVENT\n"
        "DTSTART:20261211\n"
        "SUMMARY:Moksada Ekadashi\n"
        "BEGIN:VALARM\n"
        "ACTION:DISPLAY\n"
        "DESCRIPTION:Reminder: parana tomorrow\n"
        "TRIGGER:-PT15M\n"
        "END:VALARM\n"
        "DESCRIPTION:Complete fast from grains\n"
        "END:VEVENT\n"
        "BEGIN:VEVENT\n"
        "DTSTART:20261213\n"
        "SUMMARY:Gita Jayanti\n"
        "BEGIN:VALARM\n"
        "DESCRIPTION:Parana alarm text\n"
        "END:VALARM\n"
        "END:VEVENT\n"
        "END:VCALENDAR"
    )
    events = parse_vaishnava_ics(ics, city_id="nyc")
    assert len(events) == 2
    assert events[0].fastingNote == "Complete fast from grains"
    assert events[0].type == "ekadashi"
    # Alarm text must not leak into the note or flip the type to parana.
    assert events[1].fastingNote is None
    assert events[1].type == "festival"
