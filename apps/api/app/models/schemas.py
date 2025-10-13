from pydantic import BaseModel, Field
from typing import List, Dict, Optional

class DatasetListItem(BaseModel):
    key: str
    name: str

class DatasetListResponse(BaseModel):
    items: List[DatasetListItem]

class DatasetInfo(BaseModel):
    key: str
    name: str
    description: Optional[str] = None
    image_shape: List[Optional[int]] = Field(default=[None, None, 3])
    num_classes: int
    classes: List[str]
    approx_count: Dict[str, int] = {}
    version: Optional[str] = None

class SampleResponse(BaseModel):
    dataset_key: str
    index_used: int
    label: str
    # PNG encoded as base64 data URL: "data:image/png;base64,...."
    image_data_url: str
    # optional original file path (relative inside dataset)
    path: Optional[str] = None

class GrayResponse(BaseModel):
  dataset_key: str
  path: str
  image_data_url: str

class SplitChannelsResponse(BaseModel):
  dataset_key: str
  path: str
  r_data_url: str
  g_data_url: str
  b_data_url: str

