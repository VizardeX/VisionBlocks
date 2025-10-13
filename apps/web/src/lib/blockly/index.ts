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

// NEW: class counts block
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
// UPDATED: show index field only when “by index” is selected
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
