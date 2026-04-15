import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

_DATA_PATH = Path(__file__).parent.parent.parent / "data" / "results.json"


@lru_cache(maxsize=1)
def _load_results() -> dict:
    return json.loads(_DATA_PATH.read_text())


@router.get("/results")
def get_results():
    return _load_results()
