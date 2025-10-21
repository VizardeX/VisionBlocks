from __future__ import annotations

import json
from typing import Dict, Any

from fastapi.testclient import TestClient
from app.services.image_ops import DATASETS_DIR

def test_preprocess_apply_basic(client: TestClient, any_dataset_key: str, any_image_rel: str):
    """
    Apply a minimal pipeline (reset → fit resize → pad) and confirm
    we get valid before/after data URLs and a reasonable output shape.
    """
    payload: Dict[str, Any] = {
        "dataset_key": any_dataset_key,
        "path": any_image_rel,
        "ops": [
            {"type": "reset"},
            {"type": "resize", "mode": "fit", "maxside": 256},
            {"type": "pad", "w": 256, "h": 256, "mode": "edge"},
        ],
    }
    resp = client.post("/preprocess/apply", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["dataset_key"] == any_dataset_key
    assert data["path"] == any_image_rel
    assert data["before_data_url"].startswith("data:image/")
    assert data["after_data_url"].startswith("data:image/")
    h, w, c = data["after_shape"]
    assert (h, w, c) == (256, 256, 3)

def test_preprocess_apply_edges_normalize(client: TestClient, any_dataset_key: str, any_image_rel: str):
    """
    Apply edges + normalize and verify the response is well-formed.
    """
    payload = {
        "dataset_key": any_dataset_key,
        "path": any_image_rel,
        "ops": [
            {"type": "reset"},
            {"type": "edges", "method": "canny", "threshold": 100, "overlay": False},
            {"type": "normalize", "mode": "zero_one"},
        ],
    }
    resp = client.post("/preprocess/apply", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["before_data_url"].startswith("data:image/")
    assert data["after_data_url"].startswith("data:image/")
    h, w, c = data["after_shape"]
    # shape should match original unless resize/pad changed it; at least 3 channels
    assert c == 3
    assert h > 0 and w > 0

def test_batch_export_conflict_and_overwrite(
    client: TestClient,
    any_dataset_key: str,
    temp_export_cleanup,
):
    """
    1) Export with a new name -> 200, processed > 0
    2) Export again with same name and overwrite=false -> 409
    3) Export again with overwrite=true -> 200
    """
    new_name = "pytest-m2-processed"
    # register for cleanup
    temp_export_cleanup(new_name)

    # Use a small subset to keep tests fast
    payload = {
        "dataset_key": any_dataset_key,
        "subset": {"mode": "firstN", "n": 5, "shuffle": False},
        "ops": [
            {"type": "reset"},
            {"type": "resize", "mode": "fit", "maxside": 128},
            {"type": "pad", "w": 128, "h": 128, "mode": "edge"},
            {"type": "normalize", "mode": "zero_one"},
        ],
        "new_dataset_name": new_name,
        "overwrite": False,
    }

    # First export should succeed
    resp1 = client.post("/preprocess/batch_export", json=payload)
    assert resp1.status_code == 200, resp1.text
    data1 = resp1.json()
    assert data1["base_dataset"] == any_dataset_key
    assert data1["new_dataset_key"] == new_name
    assert data1["processed"] > 0
    # Confirm folder exists
    out_dir = DATASETS_DIR / new_name
    assert out_dir.exists()
    assert (out_dir / "images").exists()
    assert (out_dir / "metadata.json").exists()

    # Second export with same name and overwrite=false should conflict (409)
    resp2 = client.post("/preprocess/batch_export", json=payload)
    assert resp2.status_code == 409, resp2.text

    # Third export with overwrite=true should succeed
    payload_overwrite = {**payload, "overwrite": True}
    resp3 = client.post("/preprocess/batch_export", json=payload_overwrite)
    assert resp3.status_code == 200, resp3.text
    data3 = resp3.json()
    assert data3["new_dataset_key"] == new_name
