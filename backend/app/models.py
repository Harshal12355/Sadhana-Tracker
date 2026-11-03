from typing import Literal

from pydantic import BaseModel


class IskconCity(BaseModel):
    id: str
    name: str
    country: str
    paranaShiftMinutes: int


class VaishnavaEventModel(BaseModel):
    date: str  # YYYY-MM-DD
    tithi: str
    paksha: Literal["Krsna", "Gaura"]
    masa: str
    festival: str | None
    type: Literal["ekadashi", "parana", "festival", "regular"]
    fastingNote: str | None
    paranaBaseWindow: tuple[str, str] | None
    paranaWindow: str | None = None


class CalendarMonthResponse(BaseModel):
    year: int
    month: int
    city: IskconCity
    events: list[VaishnavaEventModel]
    nextEkadashi: VaishnavaEventModel


class IcsImportRequest(BaseModel):
    icsText: str
    cityId: str = "nyc"


class IcsImportResponse(BaseModel):
    importedCount: int
    events: list[VaishnavaEventModel]
