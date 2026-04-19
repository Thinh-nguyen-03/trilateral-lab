import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

_DATA_PATH = Path(__file__).parent.parent.parent / "data" / "crlb.json"


@router.get("/crlb")
def get_crlb():
    if not _DATA_PATH.exists():
        raise HTTPException(
            404,
            "CRLB data not found. Run `python scripts/crlb.py` first.",
        )
    return json.loads(_DATA_PATH.read_text())
