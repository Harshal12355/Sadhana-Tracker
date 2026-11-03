"""FastAPI application for Sadhana Valli."""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .calendar_engine import ISKCON_CITIES, get_calendar_month, parse_vaishnava_ics
from .models import (
    CalendarMonthResponse,
    CitiesResponse,
    IcsImportRequest,
    IcsImportResponse,
    YouTubeResolveResponse,
)
from .youtube_resolver import resolve_youtube_metadata

app = FastAPI(title="Sadhana Valli API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sadhana-valli-api"}


@app.get("/api/cities", response_model=CitiesResponse)
def list_cities() -> CitiesResponse:
    return CitiesResponse(cities=ISKCON_CITIES)


@app.get("/api/calendar", response_model=CalendarMonthResponse)
def get_calendar(
    year: int = Query(ge=2020, le=2035),
    month: int = Query(ge=1, le=12),
    city_id: str = "nyc",
) -> CalendarMonthResponse:
    return get_calendar_month(year, month, city_id)


@app.post("/api/calendar/import-ics", response_model=IcsImportResponse)
def import_ics(payload: IcsImportRequest) -> IcsImportResponse:
    events = parse_vaishnava_ics(payload.icsText, payload.cityId)
    if not events:
        raise HTTPException(status_code=422, detail="No valid events found in .ics file")
    return IcsImportResponse(importedCount=len(events), events=events)


@app.get("/api/youtube/resolve", response_model=YouTubeResolveResponse)
def resolve_youtube(url: str) -> YouTubeResolveResponse:
    try:
        return resolve_youtube_metadata(url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
