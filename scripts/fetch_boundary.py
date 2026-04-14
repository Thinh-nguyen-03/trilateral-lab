"""
Downloads the Natural Earth 110m country boundaries and extracts the continental US polygon.
Run once before using the simulation:

    python scripts/fetch_boundary.py
"""
import json
import urllib.request
from pathlib import Path

URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
OUT = Path(__file__).parent.parent / "data" / "us_boundary.geojson"


def main():
    print(f"Fetching {URL} ...")
    with urllib.request.urlopen(URL) as r:
        data = json.loads(r.read())

    us = [
        f for f in data["features"]
        if f["properties"].get("ISO_A2") == "US"
    ]
    if not us:
        raise RuntimeError("No US feature found. The GeoJSON property names may have changed.")

    # Strip Alaska (lat > 55) and Hawaii (lon < -130) polygons
    def keep_poly(ring):
        lats = [c[1] for c in ring]
        lons = [c[0] for c in ring]
        return max(lats) < 50 and min(lons) > -130

    continental = []
    for feature in us:
        geom = feature["geometry"]
        if geom["type"] == "Polygon":
            if keep_poly(geom["coordinates"][0]):
                continental.append(feature)
        elif geom["type"] == "MultiPolygon":
            kept = [poly for poly in geom["coordinates"] if keep_poly(poly[0])]
            if kept:
                feature = {**feature, "geometry": {"type": "MultiPolygon", "coordinates": kept}}
                continental.append(feature)

    OUT.parent.mkdir(exist_ok=True)
    with open(OUT, "w") as f:
        json.dump({"type": "FeatureCollection", "features": continental}, f)

    print(f"Saved to {OUT}")


if __name__ == "__main__":
    main()
