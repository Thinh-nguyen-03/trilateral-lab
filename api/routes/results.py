import json
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

_DATA_PATH = Path(__file__).parent.parent.parent / "data" / "results.json"


@router.get("/results")
def get_results():
    return json.loads(_DATA_PATH.read_text())
