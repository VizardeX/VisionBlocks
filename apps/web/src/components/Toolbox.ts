export const toolboxJson = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Datasets",
      colour: "#5C81A6",
      contents: [
        { kind: "block", type: "dataset.select" },
        { kind: "block", type: "dataset.info" },
        { kind: "block", type: "dataset.classes" },
        { kind: "block", type: "dataset.sample_image" }
      ]
    },
    {
      kind: "category",
      name: "See Like a Computer",
      colour: "#5CA6A6",
      contents: [
        { kind: "block", type: "image.show" },
        { kind: "block", type: "image.shape" },
        { kind: "block", type: "image.channels_split" },
        { kind: "block", type: "image.to_grayscale_preview" }
      ]
    },
    {
      kind: "category",
      name: "Labels & Classes",
      colour: "#A65C81",
      contents: [
        { kind: "block", type: "label.show" },
        { kind: "block", type: "dataset.class_distribution_preview" }
      ]
    }
  ]
} as const;
