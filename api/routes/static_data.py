from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter()

_BOUNDARY_PATH = Path(__file__).parent.parent.parent / "data" / "us_boundary.geojson"


@router.get("/us-boundary")
def get_us_boundary():
    return FileResponse(
        _BOUNDARY_PATH,
        media_type="application/json",
        headers={"Cache-Control": "public, max-age=31536000"},
    )
