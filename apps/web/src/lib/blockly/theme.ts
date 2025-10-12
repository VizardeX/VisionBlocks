import * as Blockly from "blockly";

/** VisionBlocks Light */
export const LightTheme = Blockly.Theme.defineTheme("visionblocks-light", {
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: "#ffffff",
    toolboxBackgroundColour: "#f3f4f6",    // gray-100
    toolboxForegroundColour: "#111827",    // gray-900 (text)
    flyoutBackgroundColour: "#ffffff",
    flyoutForegroundColour: "#111827",
    flyoutOpacity: 0.95,
    scrollbarColour: "#d1d5db",            // gray-300
    scrollbarOpacity: 0.8,
    insertionMarkerColour: "#22d3ee",      // cyan-400
    insertionMarkerOpacity: 0.3,
    cursorColour: "#22d3ee",
  },
});

/** VisionBlocks Dark */
export const DarkTheme = Blockly.Theme.defineTheme("visionblocks-dark", {
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: "#0b0b0c",  // near-black
    toolboxBackgroundColour: "#111827",    // gray-900
    toolboxForegroundColour: "#e5e7eb",    // gray-200
    flyoutBackgroundColour: "#0f172a",     // slate-900
    flyoutForegroundColour: "#e5e7eb",     // slate-200
    flyoutOpacity: 0.98,
    scrollbarColour: "#374151",            // gray-700
    scrollbarOpacity: 0.8,
    insertionMarkerColour: "#22d3ee",      // cyan-400
    insertionMarkerOpacity: 0.35,
    cursorColour: "#22d3ee",
  },
});
