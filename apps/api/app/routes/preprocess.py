from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from pathlib import Path
import random

from app.services.image_ops import (
    DATASETS_DIR,
    load_dataset_image,
    list_all_images,
    apply_pipeline,
    pil_to_data_url,
    export_dataset,
)

router = APIRouter(prefix="/preprocess", tags=["preprocess"])

class ApplyRequest(BaseModel):
    dataset_key: str
    path: str  # e.g., "images/plastic/Image_9.jpg"
    ops: List[Dict[str, Any]] = Field(default_factory=list)

class ApplyResponse(BaseModel):
    dataset_key: str
    path: str
    before_data_url: str
    after_data_url: str
    after_shape: tuple

@router.post("/apply", response_model=ApplyResponse)
def preprocess_apply(req: ApplyRequest):
    try:
        before_img, abs_path, fmt = load_dataset_image(req.dataset_key, req.path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    after_img = apply_pipeline(before_img, req.ops)
    before_url = pil_to_data_url(before_img, fmt_hint=fmt)
    after_url  = pil_to_data_url(after_img, fmt_hint=fmt)
    shape = (after_img.height, after_img.width, len(after_img.getbands()))

    return ApplyResponse(
        dataset_key=req.dataset_key,
        path=req.path,
        before_data_url=before_url,
        after_data_url=after_url,
        after_shape=shape,
    )

class LoopSubset(BaseModel):
    mode: str = Field(pattern="^(all|firstN|randomN)$")
    n: Optional[int] = None
    shuffle: bool = False

class BatchExportRequest(BaseModel):
    dataset_key: str
    subset: LoopSubset
    ops: List[Dict[str, Any]]
    new_dataset_name: str
    overwrite: bool = False

class BatchExportResponse(BaseModel):
    base_dataset: str
    new_dataset_key: str
    processed: int
    classes: List[str]

@router.post("/batch_export", response_model=BatchExportResponse)
def preprocess_batch_export(req: BatchExportRequest):
    all_paths = list_all_images(req.dataset_key)
    rels = []
    for p in all_paths:
        # relative to dataset root
        rel = str(p.relative_to((DATASETS_DIR / req.dataset_key).resolve()))
        rels.append(rel)

    if req.subset.mode == "firstN":
        n = max(1, int(req.subset.n or 1))
        rels = rels[:n]
    elif req.subset.mode == "randomN":
        n = max(1, int(req.subset.n or 1))
        random.shuffle(rels)
        rels = rels[:n]
    else:
        # all
        pass

    if req.subset.shuffle:
        random.shuffle(rels)

    if not rels:
        raise HTTPException(status_code=400, detail="No images found for the requested subset.")

    try:
        result = export_dataset(
            base_dataset=req.dataset_key,
            rel_paths=rels,
            ops=req.ops,
            new_name=req.new_dataset_name,
            overwrite=req.overwrite,
        )
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return BatchExportResponse(
        base_dataset=req.dataset_key,
        new_dataset_key=result["new_key"],
        processed=result["processed"],
        classes=result["classes"],
    )
