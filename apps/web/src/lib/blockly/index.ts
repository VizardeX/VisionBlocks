import * as Blockly from "blockly";
import { pythonGenerator } from "blockly/python";
import datasets from "@/data/datasets.json";

// ---------- Utilities ----------
const DS_DROPDOWN = (datasets as any).items?.map((d: any) => [d.name, d.key]) ?? [];
const C_BLUE = "#5C81A6";
const C_TEAL = "#5CA6A6";
const C_MAG = "#A65C81";

function setStatement(block: Blockly.Block) {
  block.setPreviousStatement(true);
  block.setNextStatement(true);
}

// Avoid collisions
pythonGenerator.addReservedWords("dataset,image,label,r,g,b,gray,info");

// ---------- Wrap Python init ----------
const originalPyInit = pythonGenerator.init.bind(pythonGenerator);
pythonGenerator.init = function (workspace) {
  originalPyInit(workspace);
  this.definitions_ ||= Object.create(null);
  this.definitions_["__imports__"] = [
    "import random",
    "from typing import List, Tuple, Dict, Any",
    "# NOTE: Module 1 placeholders; real I/O will be backend-driven later.",
    "def load_dataset(name:str)->Dict[str,Any]:",
    "    return {'name': name}",
    "def dataset_info(ds)->Dict[str,Any]:",
    "    if ds['name']=='mnist': return {'name':'MNIST','num_images':60000,'image_shape':[28,28,1],'num_classes':10,'classes':[str(i) for i in range(10)]}",
    "    if ds['name']=='cifar10': return {'name':'CIFAR-10','num_images':50000,'image_shape':[32,32,3],'num_classes':10,'classes':['airplane','automobile','bird','cat','deer','dog','frog','horse','ship','truck']}",
    "    if ds['name']=='recyclables': return {'name':'Recyclables','num_images':3000,'image_shape':[64,64,3],'num_classes':3,'classes':['paper','plastic','metal']}",
    "    return {'name': ds['name'], 'num_images': 0, 'image_shape':[0,0,0], 'num_classes': 0, 'classes': []}",
    "def get_sample(ds, mode='random', index: int | None = None):",
    "    info = dataset_info(ds)",
    "    label = random.choice(info['classes']) if info['classes'] else 'unknown'",
    "    h,w,c = info['image_shape'] if info['image_shape'] else (0,0,1)",
    "    image = [[[(i+j)%256 for _c in range(c if c else 1)] for j in range(w)] for i in range(h)]",
    "    return image, label",
    "def image_shape(image)->List[int]:",
    "    h = len(image) if isinstance(image, list) else 0",
    "    w = len(image[0]) if h>0 else 0",
    "    c = len(image[0][0]) if w>0 and isinstance(image[0][0], list) else 1",
    "    return [h,w,c]",
    "def split_channels(image):",
    "    shape = image_shape(image)",
    "    if len(shape)<3 or shape[2]<3: return image, image, image",
    "    r = [[[pix[0]] for pix in row] for row in image]",
    "    g = [[[pix[1]] for pix in row] for row in image]",
    "    b = [[[pix[2]] for pix in row] for row in image]",
    "    return r,g,b",
    "def to_grayscale_preview(image):",
    "    shape = image_shape(image)",
    "    if len(shape)<3 or shape[2]==1: return image",
    "    gray = [[[sum(pixel)//len(pixel)] for pixel in row] for row in image]",
    "    return gray",
    "def class_distribution_preview(ds)->Dict[str,int]:",
    "    info = dataset_info(ds)",
    "    return {cls: 100 for cls in info['classes']}",
    "def show_image(_image, title: str | None = None):",
    "    print(f'[preview] image: {title or \"(no title)\"} shape={image_shape(_image)}')",
    "def show_label(_label):",
    "    print(f'[preview] label: {_label}')",
  ].join("\n");
};

// ---------- Blocks & Generators (STATEMENTS) ----------

// use dataset
Blockly.Blocks["dataset.select"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("use dataset")
      .appendField(new (Blockly as any).FieldDropdown(DS_DROPDOWN), "DATASET");
    setStatement(this);
    this.setColour(C_BLUE);
    this.setTooltip("Choose one of the provided datasets (sets current dataset).");
  }
};
pythonGenerator.forBlock["dataset.select"] = function (block: any) {
  const ds = block.getFieldValue("DATASET");
  return `dataset = load_dataset("${ds}")\n`;
};

// dataset info
Blockly.Blocks["dataset.info"] = {
  init: function () {
    this.appendDummyInput().appendField("dataset info of current dataset");
    setStatement(this);
    this.setColour(C_BLUE);
  }
};
pythonGenerator.forBlock["dataset.info"] = function () {
  return `info = dataset_info(dataset)\nprint("[info]", info)\n`;
};

// get class names
Blockly.Blocks["dataset.classes"] = {
  init: function () {
    this.appendDummyInput().appendField("get class names of current dataset");
    setStatement(this);
    this.setColour(C_BLUE);
  }
};
pythonGenerator.forBlock["dataset.classes"] = function () {
  return `print("[classes]", dataset_info(dataset)['classes'])\n`;
};

// get sample image
Blockly.Blocks["dataset.sample_image"] = {
  init: function () {
    this.appendDummyInput().appendField("get sample image from current dataset");
    this.appendDummyInput()
      .appendField("mode")
      .appendField(
        new (Blockly as any).FieldDropdown([
          ["random", "random"],
          ["by index", "index"]
        ]),
        "MODE"
      );
    this.appendDummyInput("INDEX_WRAPPER")
      .appendField("index")
      .appendField(new (Blockly as any).FieldNumber(0, 0, 999999, 1), "INDEX")
      .setVisible(false);
    setStatement(this);
    this.setColour(C_BLUE);
    this.setTooltip("Fetch a sample and set variables: image, label.");
    this.setOnChange(function () {
      const mode = (this as any).getFieldValue("MODE");
      (this as any).getInput("INDEX_WRAPPER")?.setVisible(mode === "index");
      (this as any).render();
    });
  }
};
pythonGenerator.forBlock["dataset.sample_image"] = function (block: any) {
  const mode = block.getFieldValue("MODE");
  const idx = block.getFieldValue("INDEX") ?? 0;
  return `image, label = get_sample(dataset, mode="${mode}", index=${mode === "index" ? idx : "None"})\n`;
};

// show image
Blockly.Blocks["image.show"] = {
  init: function () {
    this.appendDummyInput().appendField("show image (current)");
    this.appendDummyInput()
      .appendField("title")
      .appendField(new (Blockly as any).FieldTextInput("Sample"), "TITLE");
    setStatement(this);
    this.setColour(C_TEAL);
  }
};
pythonGenerator.forBlock["image.show"] = function (block: any) {
  const title = block.getFieldValue("TITLE") || "Sample";
  return `show_image(image, "${title}")\n`;
};

// image shape
Blockly.Blocks["image.shape"] = {
  init: function () {
    this.appendDummyInput().appendField("get image shape of current image");
    setStatement(this);
    this.setColour(C_TEAL);
  }
};
pythonGenerator.forBlock["image.shape"] = function () {
  return `print("[shape]", image_shape(image))\n`;
};

// split RGB channels (preview)
Blockly.Blocks["image.channels_split"] = {
  init: function () {
    this.appendDummyInput().appendField("split RGB channels of current image (preview)");
    setStatement(this);
    this.setColour(C_TEAL);
  }
};
pythonGenerator.forBlock["image.channels_split"] = function () {
  return `r,g,b = split_channels(image)\nshow_image(r, "Red channel")\nshow_image(g, "Green channel")\nshow_image(b, "Blue channel")\n`;
};

// grayscale preview
Blockly.Blocks["image.to_grayscale_preview"] = {
  init: function () {
    this.appendDummyInput().appendField("grayscale preview of current image");
    setStatement(this);
    this.setColour(C_TEAL);
  }
};
pythonGenerator.forBlock["image.to_grayscale_preview"] = function () {
  return `gray = to_grayscale_preview(image)\nshow_image(gray, "Grayscale")\n`;
};

// show label
Blockly.Blocks["label.show"] = {
  init: function () {
    this.appendDummyInput().appendField("show label (current)");
    setStatement(this);
    this.setColour(C_MAG);
  }
};
pythonGenerator.forBlock["label.show"] = function () {
  return `show_label(label)\n`;
};

// class distribution preview
Blockly.Blocks["dataset.class_distribution_preview"] = {
  init: function () {
    this.appendDummyInput().appendField("class distribution preview of current dataset");
    setStatement(this);
    this.setColour(C_MAG);
  }
};
pythonGenerator.forBlock["dataset.class_distribution_preview"] = function () {
  return `print("[class_dist]", class_distribution_preview(dataset))\n`;
};

export { Blockly, pythonGenerator };
