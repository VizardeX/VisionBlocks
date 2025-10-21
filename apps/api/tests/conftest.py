from __future__ import annotations

import os
import shutil
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.image_ops import DATASETS_DIR

@pytest.fixture(scope="session")
def client():
    return TestClient(app)

@pytest.fixture(scope="session")
def datasets_dir():
    return DATASETS_DIR

def _pick_any_image_rel(dataset_key: str) -> str:
    """
    Return a relative path like 'images/<class>/file.jpg' from a dataset.
    Raises if none found.
    """
    base = DATASETS_DIR / dataset_key / "images"
    if not base.exists():
        raise FileNotFoundError(f"No 'images/' for dataset {dataset_key}")
    for p in base.rglob("*"):
        if p.suffix.lower() in {".jpg", ".jpeg", ".png"}:
            # relative to ds root (DATASETS_DIR/dataset_key)
            return str(p.relative_to(DATASETS_DIR / dataset_key))
    raise FileNotFoundError(f"No images found in dataset {dataset_key}")

@pytest.fixture(scope="session")
def any_dataset_key():
    """
    Prefer the provided 'recyclables-mini' dataset.
    If you change dataset names later, update this.
    """
    default_key = "recyclables-mini"
    if (DATASETS_DIR / default_key).exists():
        return default_key
    # Fallback: pick any dataset folder containing images/
    for ds in DATASETS_DIR.iterdir():
        if (ds / "images").exists():
            return ds.name
    raise RuntimeError("No dataset with 'images/' found in data/datasets")

@pytest.fixture()
def any_image_rel(any_dataset_key):
    return _pick_any_image_rel(any_dataset_key)

@pytest.fixture()
def temp_export_cleanup():
    """Remove a dataset folder by key after a test."""
    created = []
    def register(ds_key: str):
        created.append(ds_key)
    yield register
    # cleanup
    for k in created:
        out = DATASETS_DIR / k
        if out.exists():
            shutil.rmtree(out, ignore_errors=True)
