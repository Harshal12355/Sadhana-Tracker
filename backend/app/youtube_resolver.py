"""Resolve a YouTube URL or video ID into lecture metadata (title, speaker, thumbnail)."""

import re
from urllib.parse import parse_qs, urlparse

import httpx

from .models import YouTubeResolveResponse

DEFAULT_TITLE = "ISKCON Srimad-Bhagavatam Class"
DEFAULT_SPEAKER = "Vaishnava Speaker"
NOEMBED_URL = "https://noembed.com/embed"
NOEMBED_TIMEOUT_SECONDS = 3.0

_VIDEO_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{11}$")
_YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "www.youtube-nocookie.com",
    "youtube-nocookie.com",
}
_SHORT_HOSTS = {"youtu.be", "www.youtu.be"}
_PATH_PREFIXES = ("shorts", "embed", "live", "v")


def _valid_id(candidate: str | None) -> str | None:
    if candidate and _VIDEO_ID_RE.match(candidate):
        return candidate
    return None


def extract_youtube_id(raw_input: str) -> str | None:
    """Return the 11-character video ID from a YouTube URL or bare ID, else ``None``."""
    text = raw_input.strip()
    if not text:
        return None
    if _VIDEO_ID_RE.match(text):
        return text

    parsed = urlparse(text if "://" in text else f"https://{text}")
    host = (parsed.hostname or "").lower()
    segments = [s for s in parsed.path.split("/") if s]

    if host in _SHORT_HOSTS:
        return _valid_id(segments[0]) if segments else None
    if host in _YOUTUBE_HOSTS:
        if segments and segments[0] == "watch":
            return _valid_id(parse_qs(parsed.query).get("v", [None])[0])
        if len(segments) >= 2 and segments[0] in _PATH_PREFIXES:
            return _valid_id(segments[1])
    return None


def _fetch_noembed(video_id: str, client: httpx.Client) -> dict[str, object]:
    response = client.get(
        NOEMBED_URL,
        params={"url": f"https://www.youtube.com/watch?v={video_id}"},
        timeout=NOEMBED_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, dict) else {}


def _clean(value: object, default: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return default


def resolve_youtube_metadata(
    raw_input: str, client: httpx.Client | None = None
) -> YouTubeResolveResponse:
    """Resolve metadata for a video; falls back to defaults if noembed is unavailable."""
    video_id = extract_youtube_id(raw_input)
    if video_id is None:
        raise ValueError("Invalid YouTube URL or video ID")

    owns_client = client is None
    http_client = client if client is not None else httpx.Client()
    try:
        data = _fetch_noembed(video_id, http_client)
    except (httpx.HTTPError, ValueError):
        data = {}
    finally:
        if owns_client:
            http_client.close()

    return YouTubeResolveResponse(
        youtubeId=video_id,
        youtubeUrl=f"https://www.youtube.com/watch?v={video_id}",
        title=_clean(data.get("title"), DEFAULT_TITLE),
        speaker=_clean(data.get("author_name"), DEFAULT_SPEAKER),
        thumbnailUrl=f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
    )
