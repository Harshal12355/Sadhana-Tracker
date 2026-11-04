"""Vaishnava calendar, Parana window and .ics import engine.

Mirrors the frontend source of truth in ``src/sadhanaData.ts``:
``ISKCON_CITIES``, ``DEFAULT_VAISHNAVA_CALENDAR_NOV_2026``,
``formatParanaForCity`` and ``parseVaishnavaIcs``.
"""

import calendar
import re
from datetime import date, datetime, timedelta

from .models import (
    CalendarMonthResponse,
    EventType,
    IskconCity,
    Paksha,
    VaishnavaEventModel,
)

ISKCON_CITIES: list[IskconCity] = [
    IskconCity(id="nyc", name="New York (Brooklyn)", country="USA (EST)", paranaShiftMinutes=0),
    IskconCity(id="lax", name="Los Angeles (New Dvaraka)", country="USA (PST)", paranaShiftMinutes=14),
    IskconCity(id="lon", name="London (Bhaktivedanta Manor)", country="UK (GMT)", paranaShiftMinutes=22),
    IskconCity(id="may", name="Sri Mayapur Candrodaya Mandir", country="India (IST)", paranaShiftMinutes=-35),
    IskconCity(id="mum", name="Mumbai (Juhu / Chowpatty)", country="India (IST)", paranaShiftMinutes=-18),
    IskconCity(id="tor", name="Toronto (New Remuna)", country="Canada (EST)", paranaShiftMinutes=8),
]

DEFAULT_PARANA_BASE_WINDOW: tuple[str, str] = ("06:30", "10:15")

# 15 tithi names; 15th is Purnima in Gaura paksha and Amavasya in Krsna paksha.
TITHI_NAMES: list[str] = [
    "Pratipada",
    "Dvitiya",
    "Tritiya",
    "Chaturthi",
    "Panchami",
    "Shashthi",
    "Saptami",
    "Ashtami",
    "Navami",
    "Dashami",
    "Ekadashi",
    "Dvadashi",
    "Trayodashi",
    "Chaturdashi",
]

# Vaishnava masas, Damodara (Kartika, ~Oct/Nov) first.
MASAS: list[str] = [
    "Damodara",
    "Kesava",
    "Narayana",
    "Madhava",
    "Govinda",
    "Visnu",
    "Madhusudana",
    "Trivikrama",
    "Vamana",
    "Sridhara",
    "Hrsikesa",
    "Padmanabha",
]

# Tithi cycle positions: 0 = Gaura Pratipada ... 14 = Purnima,
# 15 = Krsna Pratipada ... 29 = Amavasya. Krsna Ekadashi = 25, Gaura Ekadashi = 10.
#
# In Gaurabda 540 (2026):
#   - Pre-Nov anchor: 2026-11-01 is Krsna Saptami (index 21), placing Oct 21 on
#     Pasankusa Ekadashi (index 10) and Oct 6 on Indira Ekadashi (index 25).
#   - Post-Nov anchor: 2026-11-30 is anchored at index 21 so Dec 4 lands on
#     Utpanna Ekadashi (index 25) and Dec 5 on Utpanna Ekadashi Parana (index 26).
_PRE_ANCHOR_DATE = date(2026, 11, 1)
_PRE_ANCHOR_INDEX = 21
_POST_ANCHOR_DATE = date(2026, 11, 30)
_POST_ANCHOR_INDEX = 21
_ANCHOR_MONTH = 11  # Damodara masa is mapped to calendar month November.


def _ev(
    day: int,
    tithi: str,
    paksha: Paksha,
    masa: str,
    festival: str | None,
    type_: EventType,
    fasting_note: str | None = None,
    parana_window: tuple[str, str] | None = None,
) -> VaishnavaEventModel:
    return VaishnavaEventModel(
        date=f"2026-11-{day:02d}",
        tithi=tithi,
        paksha=paksha,
        masa=masa,
        festival=festival,
        type=type_,
        fastingNote=fasting_note,
        paranaBaseWindow=parana_window,
    )


# Built-in November 2026 (Damodara / Kesava Masa, Gaurabda 540) ISKCON Vaishnava Calendar
# Base table is calibrated for North America (New York / EST):
#   - Wed Nov 4: Rama Ekadashi (Fast)
#   - Thu Nov 5: Rama Ekadashi Parana (07:11 - 09:56 EST)
#   - Fri Nov 20: Sri Utthana Ekadashi (Fast)
#   - Sat Nov 21: Sri Utthana Ekadashi Parana (06:49 - 10:03 EST)
DEFAULT_VAISHNAVA_CALENDAR_NOV_2026: list[VaishnavaEventModel] = [
    _ev(1, "Saptami", "Krsna", "Damodara", None, "regular"),
    _ev(2, "Ashtami", "Krsna", "Damodara",
        "Bahulashtami · Manifestation of Sri Radha-kunda", "festival"),
    _ev(3, "Navami", "Krsna", "Damodara", "Sri Virabhadra — Appearance", "festival"),
    _ev(4, "Ekadashi", "Krsna", "Damodara", "Rama Ekadashi (Fast from grains & beans)", "ekadashi",
        "Complete fast from grains and beans"),
    _ev(5, "Dvadashi", "Krsna", "Damodara", "Rama Ekadashi Parana (Break Fast)", "parana",
        None, ("07:11", "09:56")),
    _ev(6, "Trayodashi", "Krsna", "Damodara", None, "regular"),
    _ev(7, "Trayodashi", "Krsna", "Damodara", None, "regular"),
    _ev(8, "Chaturdashi", "Krsna", "Damodara", None, "regular"),
    _ev(9, "Amavasya", "Krsna", "Damodara",
        "Dipavali · Dipa Dana · Kalipuja (Offering of Ghee Lamps)", "festival"),
    _ev(10, "Pratipada", "Gaura", "Damodara",
        "Govardhana Puja · Annakuta · Go-Puja · Sri Rasikananda Appearance", "festival"),
    _ev(11, "Dvitiya", "Gaura", "Damodara", "Sri Vasudeva Ghosh — Disappearance", "festival"),
    _ev(12, "Tritiya", "Gaura", "Damodara", None, "regular"),
    _ev(13, "Chaturthi", "Gaura", "Damodara",
        "Srila Prabhupada Disappearance Day (Fast till noon)", "festival",
        "Fast till noon in honor of Srila Prabhupada"),
    _ev(14, "Panchami", "Gaura", "Damodara", None, "regular"),
    _ev(15, "Shashthi", "Gaura", "Damodara", None, "regular"),
    _ev(16, "Saptami", "Gaura", "Damodara", None, "regular"),
    _ev(17, "Ashtami", "Gaura", "Damodara",
        "Gopashtami · Gosthashtami · Srila Srinivasa Acarya Disappearance", "festival"),
    _ev(18, "Navami", "Gaura", "Damodara", "Jagaddhatri Puja", "festival"),
    _ev(19, "Dashami", "Gaura", "Damodara", None, "regular"),
    _ev(20, "Ekadashi", "Gaura", "Damodara",
        "Utthana Ekadashi · Srila Gaura Kisora Dasa Babaji Disappearance · Bhisma-pancaka Begins",
        "ekadashi", "Complete fast from grains & beans · Bhisma-pancaka begins"),
    _ev(21, "Dvadashi", "Gaura", "Damodara", "Utthana Ekadashi Parana", "parana",
        None, ("06:49", "10:03")),
    _ev(22, "Trayodashi", "Gaura", "Damodara", None, "regular"),
    _ev(23, "Chaturdashi", "Gaura", "Damodara",
        "Srila Bhugarbha Gosvami & Srila Kasisvara Pandita Disappearance", "festival"),
    _ev(24, "Purnima", "Gaura", "Damodara",
        "Sri Krsna Rasayatra · Tulasi-Saligrama Vivaha · Last Day of Kartik", "festival",
        "Final evening of Damodarastakam lamp offering"),
    _ev(25, "Pratipada", "Krsna", "Kesava", "Katyayani Vrata Begins (Kesava Masa)", "festival"),
    _ev(26, "Dvitiya", "Krsna", "Kesava", None, "regular"),
    _ev(27, "Tritiya", "Krsna", "Kesava", None, "regular"),
    _ev(28, "Chaturthi", "Krsna", "Kesava", None, "regular"),
    _ev(29, "Panchami", "Krsna", "Kesava", None, "regular"),
    _ev(30, "Shashthi", "Krsna", "Kesava", None, "regular"),
]

_CANONICAL_BY_DATE: dict[str, VaishnavaEventModel] = {
    e.date: e for e in DEFAULT_VAISHNAVA_CALENDAR_NOV_2026
}

# In Europe & India (UK / IST), Dashami is present at sunrise on Nov 4, so Rama Ekadashi
# is observed on Thu Nov 5 and Parana on Fri Nov 6.
_EASTERN_HEMISPHERE_CITIES = {"lon", "may", "mum"}
_EASTERN_NOV_2026_OVERRIDES: dict[str, VaishnavaEventModel] = {
    "2026-11-04": _ev(4, "Dashami", "Krsna", "Damodara", None, "regular"),
    "2026-11-05": _ev(5, "Ekadashi", "Krsna", "Damodara",
                      "Rama Ekadashi (Fast from grains & beans)", "ekadashi",
                      "Complete fast from grains and beans"),
    "2026-11-06": _ev(6, "Dvadashi", "Krsna", "Damodara",
                      "Rama Ekadashi Parana (Break Fast)", "parana",
                      None, ("06:24", "10:18")),
}


def get_city_by_id(city_id: str) -> IskconCity:
    """Return the ISKCON city with this id; unknown ids fall back to ``nyc``."""
    for city in ISKCON_CITIES:
        if city.id == city_id:
            return city
    return ISKCON_CITIES[0]


def _shift_time(hhmm: str, delta_mins: int) -> str:
    h, m = (int(part) for part in hhmm.split(":"))
    total = (h * 60 + m + delta_mins) % 1440
    return f"{total // 60:02d}:{total % 60:02d}"


def format_parana_for_city(
    base_window: tuple[str, str] | None, city: IskconCity
) -> str | None:
    """Shift a base Parana window by the city's offset, wrapping around midnight."""
    if not base_window:
        return None
    start = _shift_time(base_window[0], city.paranaShiftMinutes)
    end = _shift_time(base_window[1], city.paranaShiftMinutes)
    city_short_name = city.name.split(" (")[0]
    return f"{start} – {end} ({city_short_name})"


def _with_city_window(event: VaishnavaEventModel, city: IskconCity) -> VaishnavaEventModel:
    return event.model_copy(
        update={"paranaWindow": format_parana_for_city(event.paranaBaseWindow, city)}
    )


def _masa_for_month(month: int) -> str:
    return MASAS[(month - _ANCHOR_MONTH) % 12]


def _algorithmic_event(day: date) -> VaishnavaEventModel:
    """Approximate event for a date by a 30-tithi cycle pinned to the nearest Nov 2026 boundary."""
    if day < _PRE_ANCHOR_DATE:
        index = ((day - _PRE_ANCHOR_DATE).days + _PRE_ANCHOR_INDEX) % 30
    else:
        index = ((day - _POST_ANCHOR_DATE).days + _POST_ANCHOR_INDEX) % 30
    paksha: Paksha = "Gaura" if index < 15 else "Krsna"
    pos = index % 15
    if pos < 14:
        tithi = TITHI_NAMES[pos]
    else:
        tithi = "Purnima" if paksha == "Gaura" else "Amavasya"

    festival: str | None = None
    fasting_note: str | None = None
    event_type: EventType = "regular"
    base_window: tuple[str, str] | None = None
    if tithi == "Ekadashi":
        event_type = "ekadashi"
        festival = "Ekadashi (Fast from grains & beans)"
        fasting_note = "Complete fast from grains and beans"
    elif tithi == "Dvadashi":  # day after Ekadashi
        event_type = "parana"
        festival = "Ekadashi Parana (Break Fast)"
        base_window = DEFAULT_PARANA_BASE_WINDOW

    return VaishnavaEventModel(
        date=day.isoformat(),
        tithi=tithi,
        paksha=paksha,
        masa=_masa_for_month(day.month),
        festival=festival,
        type=event_type,
        fastingNote=fasting_note,
        paranaBaseWindow=base_window,
    )


def _event_for_date(day: date, city: IskconCity) -> VaishnavaEventModel:
    iso = day.isoformat()
    if city.id in _EASTERN_HEMISPHERE_CITIES and iso in _EASTERN_NOV_2026_OVERRIDES:
        return _with_city_window(_EASTERN_NOV_2026_OVERRIDES[iso], city)
    canonical = _CANONICAL_BY_DATE.get(iso)
    event = canonical if canonical is not None else _algorithmic_event(day)
    return _with_city_window(event, city)


def get_calendar_month(
    year: int,
    month: int,
    city_id: str = "nyc",
    reference_date: str | None = None,
) -> CalendarMonthResponse:
    """Return all events for a month, localized for ``city_id``.

    ``nextEkadashi`` is the first Ekadashi on or after ``reference_date``
    (default: today), which may fall outside the requested month.
    """
    if not 1 <= month <= 12:
        raise ValueError(f"Invalid month: {month}")
    city = get_city_by_id(city_id)
    days_in_month = calendar.monthrange(year, month)[1]
    events = [
        _event_for_date(date(year, month, d), city) for d in range(1, days_in_month + 1)
    ]

    reference = date.fromisoformat(reference_date) if reference_date else date.today()
    next_ekadashi: VaishnavaEventModel | None = None
    for offset in range(0, 40):  # an Ekadashi occurs at least every ~15 days
        candidate = _event_for_date(reference + timedelta(days=offset), city)
        if candidate.type == "ekadashi":
            next_ekadashi = candidate
            break
    if next_ekadashi is None:  # pragma: no cover - unreachable with a 30-tithi cycle
        raise RuntimeError("No upcoming Ekadashi found")

    return CalendarMonthResponse(
        year=year,
        month=month,
        city=city,
        events=events,
        nextEkadashi=next_ekadashi,
    )


_DTSTART_RE = re.compile(r"^DTSTART(?:;[^:]*)?:(\d{4})(\d{2})(\d{2})")
_SUMMARY_RE = re.compile(r"^SUMMARY(?:;[^:]*)?:(.+)$")
_DESCRIPTION_RE = re.compile(r"^DESCRIPTION(?:;[^:]*)?:(.+)$")
_EKADASHI_RE = re.compile(r"ekadasi|ekadashi", re.IGNORECASE)
_PARANA_RE = re.compile(r"break fast|parana", re.IGNORECASE)


def _unfold_ics_lines(ics_text: str) -> list[str]:
    """Split on any newline style and join RFC 5545 folded lines."""
    lines: list[str] = []
    for raw in ics_text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if raw[:1] in (" ", "\t") and lines:
            lines[-1] += raw[1:]
        else:
            lines.append(raw)
    return lines


def parse_vaishnava_ics(
    ics_text: str, city_id: str = "nyc"
) -> list[VaishnavaEventModel]:
    """Parse VEVENTs from an .ics export (vaishnavacalendar.org, Google Calendar...)."""
    city = get_city_by_id(city_id)
    events: list[VaishnavaEventModel] = []

    in_event = False
    in_alarm = False
    fields: dict[str, str] = {}
    for line in _unfold_ics_lines(ics_text):
        stripped = line.strip()
        if stripped == "BEGIN:VEVENT":
            in_event = True
            in_alarm = False
            fields = {}
            continue
        # VALARM blocks carry their own DESCRIPTION (reminder text); never treat it as the event's.
        if in_event and stripped == "BEGIN:VALARM":
            in_alarm = True
            continue
        if in_alarm:
            if stripped == "END:VALARM":
                in_alarm = False
            elif stripped == "END:VEVENT":
                in_alarm = False
                in_event = False
                event = _build_imported_event(fields, city)
                if event is not None:
                    events.append(event)
            continue
        if stripped == "END:VEVENT":
            in_event = False
            event = _build_imported_event(fields, city)
            if event is not None:
                events.append(event)
            continue
        if not in_event:
            continue
        for key, pattern in (
            ("dtstart", _DTSTART_RE),
            ("summary", _SUMMARY_RE),
            ("description", _DESCRIPTION_RE),
        ):
            match = pattern.match(stripped)
            if match and key not in fields:
                fields[key] = (
                    "-".join(match.groups()) if key == "dtstart" else match.group(1)
                )
    return events


def _build_imported_event(
    fields: dict[str, str], city: IskconCity
) -> VaishnavaEventModel | None:
    if "dtstart" not in fields or "summary" not in fields:
        return None
    date_str = fields["dtstart"]
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return None

    summary = _unescape_ics_text(fields["summary"].strip())
    desc = _unescape_ics_text(fields.get("description", "").strip())
    is_ekadashi = bool(_EKADASHI_RE.search(summary))
    is_parana = bool(_PARANA_RE.search(f"{summary} {desc}"))
    base_window = DEFAULT_PARANA_BASE_WINDOW if is_parana else None
    event_type: EventType = (
        "ekadashi" if is_ekadashi else "parana" if is_parana else "festival"
    )
    return VaishnavaEventModel(
        date=date_str,
        tithi="Ekadashi" if is_ekadashi else "Dvadashi" if is_parana else "Tithi",
        paksha="Gaura",
        masa="Imported",
        festival=summary,
        type=event_type,
        fastingNote=desc or None,
        paranaBaseWindow=base_window,
        paranaWindow=format_parana_for_city(base_window, city),
    )


def _unescape_ics_text(text: str) -> str:
    """Unescape RFC 5545 TEXT; newlines become spaces (matches the frontend parser)."""
    return (
        text.replace("\\n", " ")
        .replace("\\N", " ")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
    )
