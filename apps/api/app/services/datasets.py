from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import csv, json, random, io, base64

from PIL import Image

from app.core.config import settings

DATASETS_DIR = settings.DATASETS_DIR

@dataclass
class DatasetIndex:
    key: str
    root: Path
    images_dir: Path
    classes: List[str]
    rows: List[Dict[str, str]]  # each row: id, path, class, split
    approx_count: Dict[str, int]
    meta: Dict

def _read_json(p: Path) -> Dict:
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)

def _read_index_csv(p: Path) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    with p.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # normalize keys
            rows.append({
                "id": row.get("id") or row.get("ID") or "",
                "path": row["path"].replace("\\", "/"),
                "class": row["class"],
                "split": row.get("split", "train")
            })
    return rows

def _encode_preview_png(img: Image.Image, max_side: int) -> str:
    # downscale for UI
    w, h = img.size
    if max(w, h) > max_side:
        if w >= h:
            new_w = max_side
            new_h = int(h * (max_side / w))
        else:
            new_h = max_side
            new_w = int(w * (max_side / h))
        img = img.resize((new_w, new_h), Image.BICUBIC)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"

def discover_datasets() -> Dict[str, DatasetIndex]:
    """
    Scan DATASETS_DIR for child folders containing metadata.json and index.csv.
    Build an in-memory index for fast access.
    """
    datasets: Dict[str, DatasetIndex] = {}
    if not DATASETS_DIR.exists():
        return datasets

    for ds_dir in DATASETS_DIR.iterdir():
        if not ds_dir.is_dir():
            continue
        meta_path = ds_dir / "metadata.json"
        csv_path = ds_dir / "index.csv"
        images_dir = ds_dir / "images"
        if not (meta_path.exists() and csv_path.exists() and images_dir.exists()):
            continue

        meta = _read_json(meta_path)
        rows = _read_index_csv(csv_path)

        # derive classes from metadata (fallback to folders)
        classes = list(meta.get("classes") or [])
        if not classes:
            classes = sorted([d.name for d in images_dir.iterdir() if d.is_dir()])

        # count per class (from csv)
        counts: Dict[str, int] = {c: 0 for c in classes}
        for r in rows:
            c = r["class"]
            if c in counts:
                counts[c] += 1

        ds_index = DatasetIndex(
            key=meta.get("key", ds_dir.name),
            root=ds_dir,
            images_dir=images_dir,
            classes=classes,
            rows=rows,
            approx_count=counts,
            meta=meta
        )
        datasets[ds_index.key] = ds_index
    return datasets

# a simple module-level cache; refreshed on startup and on-demand if needed
_DATASETS_CACHE: Optional[Dict[str, DatasetIndex]] = None

def get_datasets_index(force_refresh: bool = False) -> Dict[str, DatasetIndex]:
    global _DATASETS_CACHE
    if _DATASETS_CACHE is None or force_refresh:
        _DATASETS_CACHE = discover_datasets()
    return _DATASETS_CACHE

def list_datasets() -> List[Tuple[str, str]]:
    idx = get_datasets_index()
    items: List[Tuple[str, str]] = []
    for key, ds in idx.items():
        name = ds.meta.get("name", key)
        items.append((key, name))
    items.sort(key=lambda x: x[0])
    return items

def dataset_info(key: str) -> Dict:
    idx = get_datasets_index()
    if key not in idx:
        raise KeyError(f"Unknown dataset: {key}")
    ds = idx[key]
    meta = ds.meta.copy()
    # ensure these fields are consistent
    meta["key"] = ds.key
    meta["num_classes"] = len(ds.classes)
    meta["classes"] = ds.classes
    meta["approx_count"] = ds.approx_count
    return meta

def sample_from_dataset(key: str, mode: str = "random", index: Optional[int] = None) -> Tuple[Dict, Image.Image]:
    idx = get_datasets_index()
    if key not in idx:
        raise KeyError(f"Unknown dataset: {key}")
    ds = idx[key]
    rows = ds.rows
    if not rows:
        raise RuntimeError("Dataset has no rows in index.csv")

    if mode == "index":
        if index is None:
            raise ValueError("index is required when mode='index'")
        i = max(0, min(index, len(rows) - 1))
    else:
        i = random.randrange(0, len(rows))

    row = rows[i]
    rel = row["path"]
    img_path = ds.root / rel
    if not img_path.exists():
        raise FileNotFoundError(f"Image path not found: {rel}")

    # open image
    with Image.open(img_path) as im:
        # ensure RGB/RGBA friendly to preview
        if im.mode not in ("RGB", "RGBA", "L"):
            im = im.convert("RGB")
        im_load = im.copy()

    payload = {
        "dataset_key": key,
        "index_used": i,
        "label": row["class"],
        "path": rel
    }
    return payload, im_load

def image_data_url(im: Image.Image) -> str:
    return _encode_preview_png(im, settings.PREVIEW_MAX_SIDE)
