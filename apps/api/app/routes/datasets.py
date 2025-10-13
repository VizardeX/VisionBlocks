from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.models.schemas import (
    DatasetListResponse, DatasetListItem, DatasetInfo, SampleResponse
)
from app.services.datasets import (
    list_datasets, dataset_info, sample_from_dataset, image_data_url
)

router = APIRouter(prefix="/datasets", tags=["datasets"])

@router.get("", response_model=DatasetListResponse)
def get_datasets():
    items = [DatasetListItem(key=k, name=n) for (k, n) in list_datasets()]
    return DatasetListResponse(items=items)

@router.get("/{key}/info", response_model=DatasetInfo)
def get_dataset_info(key: str):
    try:
        info = dataset_info(key)
        return DatasetInfo(**info)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Dataset not found: {key}")

@router.get("/{key}/sample", response_model=SampleResponse)
def get_sample(
    key: str,
    mode: str = Query("random", pattern="^(random|index)$"),
    index: Optional[int] = None,
):
    try:
        payload, im = sample_from_dataset(key, mode=mode, index=index)
        data_url = image_data_url(im)
        return SampleResponse(image_data_url=data_url, **payload)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Dataset not found: {key}")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
