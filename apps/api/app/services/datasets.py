from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import csv, json, random, io, base64, time

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
                "path": (row.get("path") or "").replace("\\", "/"),
                "class": row.get("class") or "",
                "split": (row.get("split") or "train")
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

# ----------------------------
# image scan fallback
# ----------------------------

_IMG_EXTS = {".jpg", ".jpeg", ".png"}

def _scan_images_build_rows(images_dir: Path) -> Tuple[List[Dict[str, str]], Dict[str, int], List[str]]:
    """
    Build synthetic rows by scanning images/<class>/*.<ext>.
    Returns (rows, approx_count, classes)
    """
    rows: List[Dict[str, str]] = []
    counts: Dict[str, int] = {}
    classes: List[str] = []

    if not images_dir.exists():
        return rows, counts, classes

    # classes are immediate subfolders under images/
    for cls_dir in sorted([d for d in images_dir.iterdir() if d.is_dir()]):
        cls = cls_dir.name
        classes.append(cls)
        n = 0
        for p in cls_dir.rglob("*"):
            if p.is_file() and p.suffix.lower() in _IMG_EXTS:
                rel = f"images/{cls}/{p.name}"
                rows.append({
                    "id": p.stem,    # simple id
                    "path": rel.replace("\\", "/"),
                    "class": cls,
                    "split": "train",  # default (Module 3 will introduce real splits)
                })
                n += 1
        if n > 0:
            counts[cls] = n

    return rows, counts, classes

# ----------------------------
# Discovery & caching
# ----------------------------

def discover_datasets() -> Dict[str, DatasetIndex]:
    """
    Scan DATASETS_DIR for child folders containing images/.
    Prefer metadata.json + index.csv if present; otherwise synthesize rows
    by scanning images/ tree (works for Module 2 exports).
    """
    datasets: Dict[str, DatasetIndex] = {}
    if not DATASETS_DIR.exists():
        return datasets

    for ds_dir in DATASETS_DIR.iterdir():
        if not ds_dir.is_dir():
            continue

        images_dir = ds_dir / "images"
        if not images_dir.exists():
            # Not a dataset
            continue

        meta_path = ds_dir / "metadata.json"
        csv_path = ds_dir / "index.csv"

        # meta: default skeleton if missing
        meta: Dict = {"key": ds_dir.name, "name": ds_dir.name}
        if meta_path.exists():
            try:
                meta = _read_json(meta_path)
                # ensure key present
                meta["key"] = meta.get("key", ds_dir.name)
            except Exception:
                # keep default meta if json invalid
                meta = {"key": ds_dir.name, "name": ds_dir.name}

        # rows & counts: prefer csv if available; else scan filesystem
        if csv_path.exists():
            try:
                rows = _read_index_csv(csv_path)
            except Exception:
                rows = []
        else:
            rows = []

        counts: Dict[str, int] = {}
        classes: List[str] = []

        if rows:
            # derive classes from metadata (fallback to folders)
            classes = list(meta.get("classes") or [])
            if not classes:
                # infer from rows
                classes = sorted({r["class"] for r in rows if r.get("class")})
            # count per class from rows
            counts = {c: 0 for c in classes}
            for r in rows:
                c = r.get("class")
                if c in counts:
                    counts[c] += 1
            # if classes somehow still empty, fallback to scanning
            if not classes:
                rows, counts, classes = _scan_images_build_rows(images_dir)
        else:
            # scan images/ to synthesize rows
            rows, counts, classes = _scan_images_build_rows(images_dir)

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

# a module-level cache; refreshed on startup and when FS changes
_DATASETS_CACHE: Optional[Dict[str, DatasetIndex]] = None
_DATASETS_FS_SNAPSHOT: Optional[Tuple[float, Tuple[str, ...]]] = None  # (mtime, tuple_of_names)

def _fs_signature() -> Tuple[float, Tuple[str, ...]]:
    """
    Return a simple signature of DATASETS_DIR content:
    - latest mtime among dataset dirs (or DATASETS_DIR)
    - sorted tuple of dataset directory names
    This lets us cheaply detect additions/removals/changes and refresh cache.
    """
    if not DATASETS_DIR.exists():
        return (0.0, tuple())
    names: List[str] = []
    mt = DATASETS_DIR.stat().st_mtime
    for d in DATASETS_DIR.iterdir():
        if d.is_dir():
            names.append(d.name)
            try:
                mt = max(mt, d.stat().st_mtime)
            except Exception:
                pass
    names.sort()
    return (mt, tuple(names))

def get_datasets_index(force_refresh: bool = False) -> Dict[str, DatasetIndex]:
    global _DATASETS_CACHE, _DATASETS_FS_SNAPSHOT
    # Refresh if explicitly requested or FS snapshot changed
    current_sig = _fs_signature()
    if _DATASETS_CACHE is None or force_refresh or (_DATASETS_FS_SNAPSHOT != current_sig):
        _DATASETS_CACHE = discover_datasets()
        _DATASETS_FS_SNAPSHOT = current_sig
    return _DATASETS_CACHE

def list_datasets() -> List[Tuple[str, str]]:
    idx = get_datasets_index()  # auto-refreshes if FS changed
    items: List[Tuple[str, str]] = []
    for key, ds in idx.items():
        # Prefer human-friendly metadata name if present
        name = str(ds.meta.get("name") or key)
        items.append((key, name))
    items.sort(key=lambda x: x[0])
    return items

def dataset_info(key: str) -> Dict:
    idx = get_datasets_index()
    if key not in idx:
        # One more attempt with refresh, in case it was created just now.
        idx = get_datasets_index(force_refresh=True)
        if key not in idx:
            raise KeyError(f"Unknown dataset: {key}")
    ds = idx[key]
    meta = ds.meta.copy()
    # ensure these fields are consistent
    meta["key"] = ds.key
    meta["num_classes"] = len(ds.classes)
    meta["classes"] = ds.classes
    meta["approx_count"] = ds.approx_count
    # image_shape is not stored; keep Module 1 convention if the caller expects it
    if "image_shape" not in meta:
        meta["image_shape"] = [None, None, 3]
    return meta

def sample_from_dataset(key: str, mode: str = "random", index: Optional[int] = None) -> Tuple[Dict, Image.Image]:
    idx = get_datasets_index()
    if key not in idx:
        # Refresh and retry once (handles newly created datasets)
        idx = get_datasets_index(force_refresh=True)
        if key not in idx:
            raise KeyError(f"Unknown dataset: {key}")
    ds = idx[key]
    rows = ds.rows
    if not rows:
        raise RuntimeError("Dataset has no images (no rows).")

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
        # If a row is stale, rebuild the index once and retry
        get_datasets_index(force_refresh=True)
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

def load_image_by_relpath(key: str, relpath: str) -> Image.Image:
    idx = get_datasets_index()
    if key not in idx:
        idx = get_datasets_index(force_refresh=True)
        if key not in idx:
            raise KeyError(f"Unknown dataset: {key}")
    ds = idx[key]
    img_path = ds.root / relpath
    if not img_path.exists():
        raise FileNotFoundError(f"Image path not found: {relpath}")
    with Image.open(img_path) as im:
        if im.mode not in ("RGB", "RGBA", "L"):
            im = im.convert("RGB")
        return im.copy()

def to_grayscale_preview_image(im: Image.Image) -> Image.Image:
    if im.mode == "L":
        return im.copy()
    return im.convert("L")

def split_channels_tinted(im: Image.Image) -> tuple[Image.Image, Image.Image, Image.Image]:
    if im.mode not in ("RGB", "RGBA", "L"):
        im = im.convert("RGB")
    if im.mode == "L":
        # replicate grayscale to RGB (all same)
        g = im.convert("RGB")
        return g.copy(), g.copy(), g.copy()

    r, g, b = im.split()[:3]

    # make tinted images (keep one channel, zero others)
    zero = Image.new("L", im.size, 0)
    r_img = Image.merge("RGB", (r, zero, zero))
    g_img = Image.merge("RGB", (zero, g, zero))
    b_img = Image.merge("RGB", (zero, zero, b))
    return r_img, g_img, b_img
