from typing import Literal

from pydantic import BaseModel


Paksha = Literal["Krsna", "Gaura"]
EventType = Literal["ekadashi", "parana", "festival", "regular"]


class IskconCity(BaseModel):
    id: str
    name: str
    country: str
    paranaShiftMinutes: int


class VaishnavaEventModel(BaseModel):
    date: str  # YYYY-MM-DD
    tithi: str
    paksha: Paksha
    masa: str
    festival: str | None
    type: EventType
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
