"""FastAPI application for Sadhana Valli."""

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .calendar_engine import ISKCON_CITIES, get_calendar_month, parse_vaishnava_ics
from .models import (
    CalendarMonthResponse,
    CitiesResponse,
    IcsImportRequest,
    IcsImportResponse,
    YouTubeResolveResponse,
)
from .youtube_resolver import resolve_youtube_metadata

DEFAULT_STATIC_DIR = Path(
    os.environ.get("STATIC_DIR", str(Path(__file__).resolve().parents[2] / "dist"))
)


def resolve_static_file(root: Path, asset_path: str) -> Path | None:
    """Return a file inside root, or None if it is missing or escapes root."""
    root_resolved = root.resolve()
    candidate = (root_resolved / asset_path).resolve()
    if candidate == root_resolved or not candidate.is_file():
        return None
    if root_resolved != candidate and root_resolved not in candidate.parents:
        return None
    return candidate


def create_app(static_dir: Path | None = None) -> FastAPI:
    application = FastAPI(title="Sadhana Valli API")

    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "sadhana-valli-api"}

    @application.get("/api/cities", response_model=CitiesResponse)
    def list_cities() -> CitiesResponse:
        return CitiesResponse(cities=ISKCON_CITIES)

    @application.get("/api/calendar", response_model=CalendarMonthResponse)
    def get_calendar(
        year: int = Query(ge=2020, le=2035),
        month: int = Query(ge=1, le=12),
        city_id: str = "nyc",
    ) -> CalendarMonthResponse:
        return get_calendar_month(year, month, city_id)

    @application.post("/api/calendar/import-ics", response_model=IcsImportResponse)
    def import_ics(payload: IcsImportRequest) -> IcsImportResponse:
        events = parse_vaishnava_ics(payload.icsText, payload.cityId)
        if not events:
            raise HTTPException(status_code=422, detail="No valid events found in .ics file")
        return IcsImportResponse(importedCount=len(events), events=events)

    @application.get("/api/youtube/resolve", response_model=YouTubeResolveResponse)
    def resolve_youtube(url: str) -> YouTubeResolveResponse:
        try:
            return resolve_youtube_metadata(url)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    resolved_static = static_dir if static_dir is not None else DEFAULT_STATIC_DIR
    index_file = resolved_static / "index.html"
    if index_file.is_file():
        assets_dir = resolved_static / "assets"
        if assets_dir.is_dir():
            application.mount(
                "/assets",
                StaticFiles(directory=str(assets_dir)),
                name="assets",
            )

        @application.get("/", include_in_schema=False)
        def serve_spa_index() -> FileResponse:
            return FileResponse(index_file)

        @application.get("/{asset_path:path}", include_in_schema=False)
        def serve_static_asset(asset_path: str) -> FileResponse:
            found = resolve_static_file(resolved_static, asset_path)
            if found is None:
                raise HTTPException(status_code=404)
            if found.suffix == ".webmanifest":
                return FileResponse(found, media_type="application/manifest+json")
            return FileResponse(found)

    return application


app = create_app()
