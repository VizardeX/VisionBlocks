import * as BlocklyNS from "blockly/core";
import * as BlocklyPython from "blockly/python";
import "blockly/blocks";

export const Blockly = BlocklyNS;
export const pythonGenerator = BlocklyPython.pythonGenerator as any;

const C_BLUE = 200;
const C_GREEN = 120;

function setStatement(block: any) {
  block.setPreviousStatement(true, null);
  block.setNextStatement(true, null);
  block.setDeletable(true);
}

// ---------------- Module 1 Blocks ----------------

// ---------------- Datasets ----------------
Blockly.Blocks["dataset.select"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("use dataset")
      .appendField(new (Blockly as any).FieldDropdown(() => DATASET_OPTIONS), "DATASET");
    setStatement(this);
    this.setColour(C_BLUE);
    this.setTooltip("Choose one of the provided datasets (sets current dataset).");
  },
};

let DATASET_OPTIONS: [string, string][] = [
  ["Recyclables (Mini)", "recyclables-mini"], // fallback until fetched
];
export function setDatasetOptions(pairs: { name: string; key: string }[]) {
  DATASET_OPTIONS = pairs.map((p) => [p.name, p.key]);
}

Blockly.Blocks["dataset.info"] = {
  init: function () {
    this.appendDummyInput().appendField("dataset info");
    setStatement(this);
    this.setColour(C_BLUE);
    this.setTooltip("Show basic information: name and class list.");
  },
};

// class counts block
Blockly.Blocks["dataset.class_counts"] = {
  init: function () {
    this.appendDummyInput().appendField("class counts");
    setStatement(this);
    this.setColour(C_BLUE);
    this.setTooltip("Show how many images are in each class.");
  },
};

// Stays here (under Datasets category in toolbox)
Blockly.Blocks["dataset.class_distribution_preview"] = {
  init: function () {
    this.appendDummyInput().appendField("class distribution preview (percent)");
    setStatement(this);
    this.setColour(C_BLUE);
    this.setTooltip("Show the share (%) of each class in the selected dataset.");
  },
};

// ---------------- Images ----------------
Blockly.Blocks["dataset.sample_image"] = {
  init: function () {
    this.appendDummyInput().appendField("get sample image");

    const modeField = new (Blockly as any).FieldDropdown(
      [
        ["random", "random"],
        ["by index", "index"],
      ],
      (newVal: string) => {
        const blk = modeField.getSourceBlock();
        const wrap = blk?.getInput("IDX_WRAP");
        if (wrap) {
          wrap.setVisible(newVal === "index");
          blk?.render(false);
        }
        return newVal;
      }
    );

    this.appendDummyInput()
      .appendField("mode")
      .appendField(modeField, "MODE");

    // put the index in its own input so we can hide/show it
    this.appendDummyInput("IDX_WRAP")
      .appendField("index")
      .appendField(new (Blockly as any).FieldNumber(0, 0, 999999, 1), "INDEX");

    // default visibility: hidden (since default is "random")
    this.getInput("IDX_WRAP")?.setVisible(false);

    setStatement(this);
    this.setColour(C_GREEN);
    this.setTooltip("Pick a sample image (random or by index).");
  },
};

Blockly.Blocks["image.show"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("show image")
      .appendField("title")
      .appendField(new (Blockly as any).FieldTextInput("Sample"), "TITLE");
    setStatement(this);
    this.setColour(C_GREEN);
    this.setTooltip("Display the most recently sampled image.");
  },
};

Blockly.Blocks["image.shape"] = {
  init: function () {
    this.appendDummyInput().appendField("show image shape");
    setStatement(this);
    this.setColour(C_GREEN);
    this.setTooltip("Shows the image shape (will be precise in Module 2).");
  },
};

Blockly.Blocks["image.channels_split"] = {
  init: function () {
    this.appendDummyInput().appendField("split RGB channels (preview)");
    setStatement(this);
    this.setColour(C_GREEN);
    this.setTooltip("Preview Red, Green, and Blue channels of the last sample.");
  },
};

Blockly.Blocks["image.to_grayscale_preview"] = {
  init: function () {
    this.appendDummyInput().appendField("grayscale preview");
    setStatement(this);
    this.setColour(C_GREEN);
    this.setTooltip("Preview a grayscale version of the last sample.");
  },
};

// --- Minimal generators so pythonGenerator doesn't error ---
pythonGenerator.forBlock["dataset.select"] = () => "# dataset.select\n";
pythonGenerator.forBlock["dataset.info"] = () => "# dataset.info\n";
pythonGenerator.forBlock["dataset.class_counts"] = () => "# dataset.class_counts\n";
pythonGenerator.forBlock["dataset.class_distribution_preview"] = () => "# dataset.class_distribution_preview\n";
pythonGenerator.forBlock["dataset.sample_image"] = () => "# dataset.sample_image\n";
pythonGenerator.forBlock["image.show"] = () => "# image.show\n";
pythonGenerator.forBlock["image.shape"] = () => "# image.shape\n";
pythonGenerator.forBlock["image.channels_split"] = () => "# image.channels_split\n";
pythonGenerator.forBlock["image.to_grayscale_preview"] = () => "# image.to_grayscale_preview\n";

// ---------------- Module 2 Blocks ----------------

// Small helpers
const C_VIOLET = 260; // preprocessing
const C_AMBER = 40;   // analysis

function setStatementIO(block: any) {
  // Statement block that also can contain inner statements (for loops)
  block.setPreviousStatement(true, null);
  block.setNextStatement(true, null);
  block.setDeletable(true);
}

// Working image reset
Blockly.Blocks["m2.reset_working"] = {
  init: function () {
    this.appendDummyInput().appendField("reset working image");
    setStatement(this);
    this.setColour(C_VIOLET);
    this.setTooltip("Set the working image back to the original sample.");
  },
};

// Resize
Blockly.Blocks["m2.resize"] = {
  init: function () {
    const mode = new (Blockly as any).FieldDropdown([
      ["to size", "size"],
      ["fit within", "fit"],
      ["scale (%)", "scale"],
    ], (val: string) => {
      const blk = mode.getSourceBlock();
      if (!blk) return val;
      blk.getInput("SIZE_WRAP")?.setVisible(val === "size");
      blk.getInput("FIT_WRAP")?.setVisible(val === "fit");
      blk.getInput("SCALE_WRAP")?.setVisible(val === "scale");
      blk.render(false);
      return val;
    });

    this.appendDummyInput().appendField("resize image");
    this.appendDummyInput().appendField("mode").appendField(mode, "MODE");

    this.appendDummyInput("SIZE_WRAP")
      .appendField("width")
      .appendField(new (Blockly as any).FieldNumber(256, 1, 4096, 1), "W")
      .appendField("height")
      .appendField(new (Blockly as any).FieldNumber(256, 1, 4096, 1), "H")
      .appendField("keep aspect")
      .appendField(new (Blockly as any).FieldCheckbox("TRUE"), "KEEP");

    this.appendDummyInput("FIT_WRAP")
      .appendField("max side")
      .appendField(new (Blockly as any).FieldNumber(256, 1, 4096, 1), "MAXSIDE");

    this.appendDummyInput("SCALE_WRAP")
      .appendField("percent")
      .appendField(new (Blockly as any).FieldNumber(100, 1, 1000, 1), "PCT");

    // default visible
    this.getInput("SIZE_WRAP")?.setVisible(true);
    this.getInput("FIT_WRAP")?.setVisible(false);
    this.getInput("SCALE_WRAP")?.setVisible(false);

    setStatement(this);
    this.setColour(C_VIOLET);
    this.setTooltip("Resize using size, fit within max side, or scale percent.");
  },
};

// Center crop
Blockly.Blocks["m2.crop_center"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("center crop")
      .appendField("width")
      .appendField(new (Blockly as any).FieldNumber(224, 1, 4096, 1), "W")
      .appendField("height")
      .appendField(new (Blockly as any).FieldNumber(224, 1, 4096, 1), "H");
    setStatement(this);
    this.setColour(C_VIOLET);
    this.setTooltip("Crop centered region to width × height.");
  },
};

// Pad
Blockly.Blocks["m2.pad"] = {
  init: function () {
    const mode = new (Blockly as any).FieldDropdown([
      ["constant (color)", "constant"],
      ["edge", "edge"],
      ["reflect", "reflect"],
    ], (val: string) => {
      const blk = mode.getSourceBlock();
      const colorInput = blk?.getInput("COLOR_WRAP");
      if (colorInput) {
        colorInput.setVisible(val === "constant");
        blk?.render(false);
      }
      return val;
    });

    this.appendDummyInput().appendField("pad image to size");
    this.appendDummyInput()
      .appendField("width").appendField(new (Blockly as any).FieldNumber(256, 1, 4096, 1), "W")
      .appendField("height").appendField(new (Blockly as any).FieldNumber(256, 1, 4096, 1), "H");
    this.appendDummyInput().appendField("mode").appendField(mode, "MODE");
    this.appendDummyInput("COLOR_WRAP")
      .appendField("color (R,G,B)")
      .appendField(new (Blockly as any).FieldNumber(0, 0, 255, 1), "R")
      .appendField(new (Blockly as any).FieldNumber(0, 0, 255, 1), "G")
      .appendField(new (Blockly as any).FieldNumber(0, 0, 255, 1), "B");
    this.getInput("COLOR_WRAP")?.setVisible(true);

    setStatement(this);
    this.setColour(C_VIOLET);
    this.setTooltip("Pad to target size with a chosen mode. Color is used only for constant mode.");
  },
};

// Brightness / Contrast
Blockly.Blocks["m2.brightness_contrast"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("brightness / contrast")
      .appendField("brightness")
      .appendField(new (Blockly as any).FieldNumber(0, -50, 50, 1), "B")
      .appendField("contrast")
      .appendField(new (Blockly as any).FieldNumber(0, -50, 50, 1), "C");
    setStatement(this);
    this.setColour(C_VIOLET);
    this.setTooltip("Adjust brightness and contrast.");
  },
};

// Blur / Sharpen
Blockly.Blocks["m2.blur_sharpen"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("blur / sharpen")
      .appendField("blur radius")
      .appendField(new (Blockly as any).FieldNumber(0, 0, 20, 0.5), "BLUR")
      .appendField("sharpen amount")
      .appendField(new (Blockly as any).FieldNumber(0, 0, 3, 0.1), "SHARP");
    setStatement(this);
    this.setColour(C_VIOLET);
    this.setTooltip("Apply blur and/or sharpening.");
  },
};

// Edge detection
Blockly.Blocks["m2.edges"] = {
  init: function () {
    const method = new (Blockly as any).FieldDropdown([
      ["Canny", "canny"],
      ["Sobel", "sobel"],
      ["Laplacian", "laplacian"],
      ["Prewitt", "prewitt"],
    ]);
    this.appendDummyInput()
      .appendField("detect edges")
      .appendField("method").appendField(method, "METHOD");
    this.appendDummyInput()
      .appendField("threshold")
      .appendField(new (Blockly as any).FieldNumber(100, 0, 255, 1), "THRESH");
    this.appendDummyInput()
      .appendField("overlay")
      .appendField(new (Blockly as any).FieldCheckbox("FALSE"), "OVERLAY");
    setStatement(this);
    this.setColour(C_VIOLET);
    this.setTooltip("Highlight edges using the selected method.");
  },
};

// To grayscale (actual transform)
Blockly.Blocks["m2.to_grayscale"] = {
  init: function () {
    this.appendDummyInput().appendField("convert to grayscale");
    setStatement(this);
    this.setColour(C_VIOLET);
    this.setTooltip("Convert working image to grayscale.");
  },
};

// Normalize
Blockly.Blocks["m2.normalize"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("normalize pixels")
      .appendField(new (Blockly as any).FieldDropdown([
        ["0–1", "zero_one"],
        ["-1–1", "minus_one_one"],
        ["z-score (per channel)", "zscore"],
      ]), "MODE");
    setStatement(this);
    this.setColour(C_VIOLET);
    this.setTooltip("Scale pixel values to a standard range.");
  },
};

// Show working image
Blockly.Blocks["m2.show_working"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("show working image")
      .appendField("title")
      .appendField(new (Blockly as any).FieldTextInput("Processed"), "TITLE");
    setStatement(this);
    this.setColour(C_VIOLET);
    this.setTooltip("Display the image after preprocessing steps.");
  },
};

// Before / After
Blockly.Blocks["m2.before_after"] = {
  init: function () {
    this.appendDummyInput().appendField("show before / after");
    setStatement(this);
    this.setColour(C_AMBER);
    this.setTooltip("Compare original vs current working image.");
  },
};

// Working shape
Blockly.Blocks["m2.shape"] = {
  init: function () {
    this.appendDummyInput().appendField("show working image shape");
    setStatement(this);
    this.setColour(C_AMBER);
    this.setTooltip("Show (height, width, channels) of the processed image.");
  },
};

// Loop over dataset (no split)
Blockly.Blocks["m2.loop_dataset"] = {
  init: function () {
    const sub = new (Blockly as any).FieldDropdown([
      ["all", "all"],
      ["first N", "firstN"],
      ["random N", "randomN"],
    ], (val: string) => {
      const blk = sub.getSourceBlock();
      const nWrap = blk?.getInput("N_WRAP");
      if (nWrap) {
        nWrap.setVisible(val !== "all");
        blk?.render(false);
      }
      return val;
    });

    this.appendDummyInput()
      .appendField("for each image in dataset")
      .appendField("subset").appendField(sub, "SUBSET");
    this.appendDummyInput("N_WRAP")
      .appendField("N")
      .appendField(new (Blockly as any).FieldNumber(50, 1, 100000, 1), "N");
    this.getInput("N_WRAP")?.setVisible(false);
    this.appendDummyInput()
      .appendField("shuffle")
      .appendField(new (Blockly as any).FieldCheckbox("FALSE"), "SHUFFLE");
    this.appendDummyInput()
      .appendField("progress every")
      .appendField(new (Blockly as any).FieldNumber(10, 1, 1000, 1), "K")
      .appendField("images");

    this.appendStatementInput("DO").appendField("do");

    setStatementIO(this);
    this.setColour(C_VIOLET);
    this.setTooltip("Run the inner steps for every image in the dataset (subset/shuffle optional).");
  },
};

// Export processed dataset
Blockly.Blocks["m2.export_dataset"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("export processed dataset")
      .appendField("name")
      .appendField(new (Blockly as any).FieldTextInput("recyclables-processed"), "NAME");

    this.appendDummyInput()
      .appendField("overwrite if exists")
      .appendField(new (Blockly as any).FieldCheckbox("FALSE"), "OVERWRITE");

    setStatement(this);
    this.setColour(C_VIOLET);
    this.setTooltip(
      "Save processed images to a new dataset folder (same format as original) with metadata.json."
    );
  },
};

// --- Minimal generators so pythonGenerator doesn't error ---
pythonGenerator.forBlock["m2.reset_working"] = () => "# m2.reset_working\n";
pythonGenerator.forBlock["m2.resize"] = () => "# m2.resize\n";
pythonGenerator.forBlock["m2.crop_center"] = () => "# m2.crop_center\n";
pythonGenerator.forBlock["m2.pad"] = () => "# m2.pad\n";
pythonGenerator.forBlock["m2.brightness_contrast"] = () => "# m2.brightness_contrast\n";
pythonGenerator.forBlock["m2.blur_sharpen"] = () => "# m2.blur_sharpen\n";
pythonGenerator.forBlock["m2.edges"] = () => "# m2.edges\n";
pythonGenerator.forBlock["m2.to_grayscale"] = () => "# m2.to_grayscale\n";
pythonGenerator.forBlock["m2.normalize"] = () => "# m2.normalize\n";
pythonGenerator.forBlock["m2.show_working"] = () => "# m2.show_working\n";
pythonGenerator.forBlock["m2.before_after"] = () => "# m2.before_after\n";
pythonGenerator.forBlock["m2.shape"] = () => "# m2.shape\n";
pythonGenerator.forBlock["m2.loop_dataset"] = () => "# m2.loop_dataset\n";
pythonGenerator.forBlock["m2.export_dataset"] = () => "# m2.export_dataset\n";

