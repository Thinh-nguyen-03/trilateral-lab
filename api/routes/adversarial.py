import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

_DATA_PATH = Path(__file__).parent.parent.parent / "data" / "adversarial.json"


@router.get("/adversarial")
def get_adversarial():
    if not _DATA_PATH.exists():
        raise HTTPException(
            404,
            "Adversarial placement data not found. Run `python scripts/adversarial_placement.py` first.",
        )
    return json.loads(_DATA_PATH.read_text())
