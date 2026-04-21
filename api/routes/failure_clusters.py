import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

_DATA_PATH = Path(__file__).parent.parent.parent / "data" / "failure_clusters.json"


@router.get("/failure-clusters")
def get_failure_clusters():
    if not _DATA_PATH.exists():
        raise HTTPException(
            404,
            "Failure cluster data not found. Run `python scripts/cluster_failures.py` first.",
        )
    return json.loads(_DATA_PATH.read_text())
