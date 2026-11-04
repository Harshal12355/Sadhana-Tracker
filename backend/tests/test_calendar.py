from app.calendar_engine import (
    format_parana_for_city,
    get_calendar_month,
    get_city_by_id,
    parse_vaishnava_ics,
)


def test_november_2026_returns_authentic_iskcon_gaurabda_540_dates():
    res = get_calendar_month(2026, 11, "nyc", reference_date="2026-11-04")
    assert res.year == 2026
    assert res.month == 11
    assert res.city.id == "nyc"
    assert len(res.events) == 30

    by_date = {e.date: e for e in res.events}
    # Nov 2, 2026 (Mon): Bahulashtami / Radha-kunda Appearance
    assert by_date["2026-11-02"].tithi == "Ashtami"
    assert by_date["2026-11-02"].type == "festival"
    assert "Bahulashtami" in (by_date["2026-11-02"].festival or "")

    # Nov 4, 2026 (Wed): Rama Ekadashi in New York (EST)
    assert by_date["2026-11-04"].tithi == "Ekadashi"
    assert by_date["2026-11-04"].type == "ekadashi"
    assert "Rama Ekadashi" in (by_date["2026-11-04"].festival or "")
    assert res.nextEkadashi.date == "2026-11-04"

    # Nov 5, 2026 (Thu): Rama Ekadashi Parana in New York (07:11 - 09:56)
    assert by_date["2026-11-05"].tithi == "Dvadashi"
    assert by_date["2026-11-05"].type == "parana"
    assert by_date["2026-11-05"].paranaWindow == "07:11 – 09:56 (New York)"

    # Nov 9, 2026 (Mon): Dipavali / Dipa Dana
    assert by_date["2026-11-09"].tithi == "Amavasya"
    assert "Dipavali" in (by_date["2026-11-09"].festival or "")

    # Nov 10, 2026 (Tue): Govardhana Puja
    assert by_date["2026-11-10"].tithi == "Pratipada"
    assert "Govardhana Puja" in (by_date["2026-11-10"].festival or "")

    # Nov 13, 2026 (Fri): Srila Prabhupada Disappearance Day
    assert "Prabhupada" in (by_date["2026-11-13"].festival or "")

    # Nov 20, 2026 (Fri): Utthana Ekadashi in New York
    assert by_date["2026-11-20"].tithi == "Ekadashi"
    assert by_date["2026-11-20"].type == "ekadashi"
    assert "Utthana Ekadashi" in (by_date["2026-11-20"].festival or "")

    # Nov 21, 2026 (Sat): Utthana Ekadashi Parana in New York (06:49 - 10:03)
    assert by_date["2026-11-21"].type == "parana"
    assert by_date["2026-11-21"].paranaWindow == "06:49 – 10:03 (New York)"

    # Nov 24, 2026 (Tue): Kartik Purnima / Rasayatra
    assert by_date["2026-11-24"].tithi == "Purnima"
    assert "Rasayatra" in (by_date["2026-11-24"].festival or "")

    # Eastern Hemisphere (Mayapur / India): Rama Ekadashi is Nov 5, Parana Nov 6
    may_res = get_calendar_month(2026, 11, "may", reference_date="2026-11-04")
    may_by_date = {e.date: e for e in may_res.events}
    assert may_by_date["2026-11-04"].tithi == "Dashami"
    assert may_by_date["2026-11-05"].type == "ekadashi"
    assert may_by_date["2026-11-06"].type == "parana"


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
    assert len(paranas) >= 2
    assert all("London" in (p.paranaWindow or "") for p in paranas)


def test_unknown_city_falls_back_to_nyc():
    assert get_city_by_id("unknown").id == "nyc"


def test_dec_2026_has_utpanna_and_moksada_ekadashi():
    res = get_calendar_month(2026, 12, "lon")
    by_date = {e.date: e for e in res.events}
    assert by_date["2026-12-04"].type == "ekadashi"
    assert by_date["2026-12-05"].type == "parana"
    assert by_date["2026-12-05"].paranaWindow == "06:52 – 10:37 (London)"


def test_oct_2026_has_indira_and_pasankusa_ekadashi():
    res = get_calendar_month(2026, 10, "nyc", reference_date="2026-10-31")
    by_date = {e.date: e for e in res.events}
    assert by_date["2026-10-06"].type == "ekadashi"
    assert by_date["2026-10-21"].type == "ekadashi"
    assert by_date["2026-10-31"].type == "regular"
    assert res.nextEkadashi.date == "2026-11-04"


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
    assert events[1].fastingNote is None
    assert events[1].type == "festival"
