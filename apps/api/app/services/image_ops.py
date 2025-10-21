from __future__ import annotations
from pathlib import Path
from typing import Dict, List, Tuple, Any
import io
import json

import numpy as np
import cv2
from PIL import Image

# Root containing datasets/<dataset_key>/
DATASETS_DIR = (Path(__file__).resolve().parents[1] / "data" / "datasets").resolve()

IMG_EXTS = {".jpg", ".jpeg", ".png"}

# ------------------------
# Utilities
# ------------------------

def _pil_to_cv_bgr(img: Image.Image) -> np.ndarray:
    """PIL (any mode) -> OpenCV BGR uint8"""
    if img.mode != "RGB":
        img = img.convert("RGB")
    arr = np.array(img)  # RGB
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)

def _cv_bgr_to_pil(cv_img: np.ndarray) -> Image.Image:
    """OpenCV BGR uint8 -> PIL RGB"""
    rgb = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)

def _ensure_rgb_pil(img: Image.Image) -> Image.Image:
    return img if img.mode == "RGB" else img.convert("RGB")

def pil_to_data_url(img: Image.Image, fmt_hint: str | None = None) -> str:
    """
    Convert PIL image to data URL. Keep JPEG/PNG per hint.
    """
    fmt = fmt_hint or (img.format if img.format in ("JPEG", "PNG") else "PNG")
    buf = io.BytesIO()
    if fmt == "JPEG":
        img.save(buf, format="JPEG", quality=90)
        mime = "image/jpeg"
    else:
        img.save(buf, format="PNG")
        mime = "image/png"
    import base64
    return f"data:{mime};base64,{base64.b64encode(buf.getvalue()).decode('ascii')}"

def load_dataset_image(dataset_key: str, rel_path: str) -> Tuple[Image.Image, Path, str]:
    """
    Load image by dataset key + relative path (e.g., 'images/class/file.jpg').
    Returns (PIL image, absolute path, 'JPEG'|'PNG' by extension).
    """
    ds_root = (DATASETS_DIR / dataset_key).resolve()
    abs_path = (ds_root / rel_path).resolve()
    if not str(abs_path).startswith(str(ds_root)):
        raise ValueError("Invalid path.")
    if not abs_path.exists():
        raise FileNotFoundError(f"Image not found: {rel_path}")
    img = Image.open(abs_path)
    ext = abs_path.suffix.lower()
    fmt = "JPEG" if ext in (".jpg", ".jpeg") else "PNG"
    return img, abs_path, fmt

def list_all_images(dataset_key: str) -> List[Path]:
    base = (DATASETS_DIR / dataset_key / "images").resolve()
    if not base.exists():
        return []
    return [p for p in base.rglob("*") if p.is_file() and p.suffix.lower() in IMG_EXTS]

# ------------------------
# Operations (OpenCV)
# ------------------------

def op_reset(cv_img: np.ndarray, cv_orig: np.ndarray, **_) -> np.ndarray:
    return cv_orig.copy()

def op_resize(
    cv_img: np.ndarray,
    mode: str,
    keep: bool | str | None = None,
    w: int | None = None,
    h: int | None = None,
    maxside: int | None = None,
    pct: int | None = None,
) -> np.ndarray:
    keep_bool = False
    if isinstance(keep, str):
        keep_bool = keep.upper() == "TRUE"
    elif isinstance(keep, bool):
        keep_bool = keep

    if mode == "size":
        w = int(w or 256); h = int(h or 256)
        if keep_bool:
            # contain within (w, h) without distortion
            ih, iw = cv_img.shape[:2]
            scale = min(w / iw, h / ih) if iw > 0 and ih > 0 else 1.0
            new_w, new_h = max(1, int(iw * scale)), max(1, int(ih * scale))
            return cv2.resize(cv_img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
        else:
            return cv2.resize(cv_img, (w, h), interpolation=cv2.INTER_LANCZOS4)

    elif mode == "fit":
        ms = int(maxside or 256)
        ih, iw = cv_img.shape[:2]
        scale = ms / max(iw, ih) if max(iw, ih) > 0 else 1.0
        new_w, new_h = max(1, int(iw * scale)), max(1, int(ih * scale))
        return cv2.resize(cv_img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    elif mode == "scale":
        pct = int(pct or 100)
        ih, iw = cv_img.shape[:2]
        new_w = max(1, int(iw * pct / 100.0))
        new_h = max(1, int(ih * pct / 100.0))
        return cv2.resize(cv_img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    return cv_img

def op_crop_center(cv_img: np.ndarray, w: int, h: int) -> np.ndarray:
    w = int(w); h = int(h)
    ih, iw = cv_img.shape[:2]
    cx, cy = iw // 2, ih // 2
    x0 = max(0, cx - w // 2)
    y0 = max(0, cy - h // 2)
    x1 = min(iw, x0 + w)
    y1 = min(ih, y0 + h)
    return cv_img[y0:y1, x0:x1]

def op_pad(cv_img: np.ndarray, w: int, h: int, mode: str, r: int = 0, g: int = 0, b: int = 0) -> np.ndarray:
    """Letterbox pad into exact (w,h)."""
    w = int(w); h = int(h)
    ih, iw = cv_img.shape[:2]
    top = max(0, (h - ih) // 2)
    bottom = max(0, h - ih - top)
    left = max(0, (w - iw) // 2)
    right = max(0, w - iw - left)

    if mode == "constant":
        color_bgr = (int(b), int(g), int(r))  # BGR
        return cv2.copyMakeBorder(cv_img, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color_bgr)
    elif mode == "edge":
        return cv2.copyMakeBorder(cv_img, top, bottom, left, right, cv2.BORDER_REPLICATE)
    elif mode == "reflect":
        return cv2.copyMakeBorder(cv_img, top, bottom, left, right, cv2.BORDER_REFLECT)
    else:
        return cv_img

def op_brightness_contrast(cv_img: np.ndarray, b: float, c: float) -> np.ndarray:
    """
    brightness/contrast sliders in [-50, 50]:
      alpha = 1 + c/100  → contrast
      beta  = 2.55 * b   → brightness (approx mapping to 0..255)
    new = img*alpha + beta
    """
    alpha = 1.0 + (float(c) / 100.0)
    beta = 2.55 * float(b)
    out = cv2.convertScaleAbs(cv_img, alpha=alpha, beta=beta)
    return out

def op_blur_sharpen(cv_img: np.ndarray, blur: float, sharp: float) -> np.ndarray:
    blur = float(blur or 0)
    sharp = float(sharp or 0)
    out = cv_img.copy()
    if blur > 0:
        # Cap radius, compute kernel size as odd
        k = max(1, int(round(blur * 2 + 1)))
        if k % 2 == 0:
            k += 1
        out = cv2.GaussianBlur(out, (k, k), sigmaX=blur)
    if sharp > 0:
        # Unsharp masking: out + amount*(out - blurred)
        blur_k = 3
        if blur_k % 2 == 0:
            blur_k += 1
        blurred = cv2.GaussianBlur(out, (blur_k, blur_k), 0)
        amount = min(3.0, sharp)
        out = cv2.addWeighted(out, 1.0 + amount, blurred, -amount, 0)
        out = np.clip(out, 0, 255).astype(np.uint8)
    return out

def _edges_mask(cv_img: np.ndarray, method: str, threshold: float) -> np.ndarray:
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    if method == "canny":
        lo = max(0, int(threshold))
        hi = min(255, int(threshold) + 60)
        edges = cv2.Canny(gray, lo, hi)
        return (edges > 0).astype(np.uint8)
    elif method == "sobel":
        gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        mag = cv2.magnitude(gx, gy)
        mag = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        return (mag >= int(threshold)).astype(np.uint8)
    elif method == "laplacian":
        lap = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
        mag = np.abs(lap)
        mag = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        return (mag >= int(threshold)).astype(np.uint8)
    elif method == "prewitt":
        kx = np.array([[ -1, 0, 1],
                       [ -1, 0, 1],
                       [ -1, 0, 1]], dtype=np.float32)
        ky = np.array([[  1,  1,  1],
                       [  0,  0,  0],
                       [ -1, -1, -1]], dtype=np.float32)
        gx = cv2.filter2D(gray.astype(np.float32), -1, kx)
        gy = cv2.filter2D(gray.astype(np.float32), -1, ky)
        mag = cv2.magnitude(gx, gy)
        mag = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        return (mag >= int(threshold)).astype(np.uint8)
    else:
        edges = cv2.Canny(gray, 100, 160)
        return (edges > 0).astype(np.uint8)

def op_edges(cv_img: np.ndarray, method: str, threshold: int, overlay: bool) -> np.ndarray:
    mask = _edges_mask(cv_img, method, float(threshold))
    if overlay:
        out = cv_img.copy()
        out[mask.astype(bool)] = (0, 0, 255)  # red in BGR
        return out
    else:
        # edges-only in grayscale, then convert to 3-channel for consistency
        e = (mask * 255).astype(np.uint8)
        return cv2.cvtColor(e, cv2.COLOR_GRAY2BGR)

def op_to_grayscale(cv_img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

def op_normalize(cv_img: np.ndarray, mode: str) -> np.ndarray:
    arr = cv_img.astype(np.float32)
    if mode == "zero_one":
        arr = np.clip(arr / 255.0, 0.0, 1.0)
        out = (arr * 255.0).round().astype(np.uint8)
        return out
    elif mode == "minus_one_one":
        arr = (arr / 255.0) * 2.0 - 1.0
        arr = (arr + 1.0) / 2.0
        out = (np.clip(arr, 0.0, 1.0) * 255.0).round().astype(np.uint8)
        return out
    elif mode == "zscore":
        # per-channel z-score, clip to [-2,2], then min-max to 0..255 for display
        out = np.empty_like(arr)
        for c in range(3):
            ch = arr[..., c]
            mu = float(ch.mean())
            sd = float(ch.std()) or 1.0
            z = (ch - mu) / sd
            z = np.clip(z, -2.0, 2.0)
            # map [-2, 2] -> [0, 255]
            out[..., c] = ((z + 2.0) / 4.0 * 255.0).round()
        return out.astype(np.uint8)
    else:
        return cv_img

# ------------------------
# Pipeline + Export
# ------------------------

def apply_pipeline(original_pil: Image.Image, ops: List[Dict[str, Any]]) -> Image.Image:
    """Apply ordered ops to a single image using OpenCV, return PIL RGB result."""
    orig_cv = _pil_to_cv_bgr(_ensure_rgb_pil(original_pil))
    cv_img = orig_cv.copy()
    for op in ops:
        t = op.get("type")
        if t == "reset":
            cv_img = op_reset(cv_img, orig_cv)
        elif t == "resize":
            cv_img = op_resize(
                cv_img,
                mode=op.get("mode","size"),
                keep=op.get("keep","FALSE"),
                w=op.get("w"),
                h=op.get("h"),
                maxside=op.get("maxside"),
                pct=op.get("pct"),
            )
        elif t == "crop_center":
            cv_img = op_crop_center(cv_img, w=int(op.get("w",224)), h=int(op.get("h",224)))
        elif t == "pad":
            cv_img = op_pad(
                cv_img, w=int(op.get("w",256)), h=int(op.get("h",256)),
                mode=op.get("mode","constant"),
                r=int(op.get("r",0)), g=int(op.get("g",0)), b=int(op.get("b",0))
            )
        elif t == "brightness_contrast":
            cv_img = op_brightness_contrast(cv_img, b=float(op.get("b",0)), c=float(op.get("c",0)))
        elif t == "blur_sharpen":
            cv_img = op_blur_sharpen(cv_img, blur=float(op.get("blur",0)), sharp=float(op.get("sharp",0)))
        elif t == "edges":
            cv_img = op_edges(cv_img, method=str(op.get("method","canny")), threshold=int(op.get("threshold",100)), overlay=bool(op.get("overlay", False)))
        elif t == "to_grayscale":
            cv_img = op_to_grayscale(cv_img)
        elif t == "normalize":
            cv_img = op_normalize(cv_img, mode=str(op.get("mode","zero_one")))
        elif t in (None, ""):
            continue
        else:
            # Unknown op: ignore
            continue
    return _cv_bgr_to_pil(cv_img)

def sanitize_name(name: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in "-_." else "-" for ch in name).strip("-_.")
    if not safe: safe = "processed"
    return safe[:60]

def export_dataset(
    base_dataset: str,
    rel_paths: List[str],
    ops: List[Dict[str, Any]],
    new_name: str,
    overwrite: bool = False,
) -> Dict[str, Any]:
    new_key = sanitize_name(new_name)
    src_root = (DATASETS_DIR / base_dataset).resolve()
    out_root = (DATASETS_DIR / new_key).resolve()

    # Handle overwrite
    if out_root.exists():
        if not overwrite:
            raise FileExistsError(f"Dataset '{new_key}' already exists.")
        import shutil
        shutil.rmtree(out_root)

    (out_root / "images").mkdir(parents=True, exist_ok=True)

    processed = 0
    classes = set()

    for rel in rel_paths:
        pil_img, abs_path, fmt = load_dataset_image(base_dataset, rel)

        # infer class folder from rel path: images/<class>/file
        rel_p = Path(rel)
        cls = rel_p.parts[1] if len(rel_p.parts) >= 3 else "unknown"
        classes.add(cls)

        out_dir = (out_root / "images" / cls)
        out_dir.mkdir(parents=True, exist_ok=True)

        out_pil = apply_pipeline(pil_img, ops)
        out_fp = out_dir / Path(rel).name

        if fmt == "JPEG":
            out_pil = out_pil.convert("RGB")
            out_pil.save(out_fp, format="JPEG", quality=90)
        else:
            out_pil.save(out_fp, format="PNG")
        processed += 1

    # metadata.json
    meta = {
        "name": new_key,
        "base_dataset": base_dataset,
        "num_classes": len(classes),
        "classes": sorted(list(classes)),
        "image_count": processed,
        "preprocessing": ops,
        "format": "same_as_source",
        "version": "1.0.0",
    }
    with open(out_root / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    return {
        "new_key": new_key,
        "processed": processed,
        "classes": sorted(list(classes)),
        "path": str(out_root),
    }
