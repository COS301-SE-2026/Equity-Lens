import { describe, it, expect } from "vitest";
import {
  CHART_COLORS,
  DEFAULT_MARGIN,
  TOOLTIP_STYLE,
  TOOLTIP_LABEL_STYLE,
  AXIS_TICK_STYLE,
  LEGEND_STYLE,
  GRID_STROKE,
} from "./chartConfig";

describe("chartConstants", () => {
  it("CHART_COLORS has 6 colours", () => {
    expect(CHART_COLORS).toHaveLength(6);
  });

  it("CHART_COLORS contains only valid hex values", () => {
    CHART_COLORS.forEach((color) => {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it("DEFAULT_MARGIN has the correct values", () => {
    expect(DEFAULT_MARGIN).toEqual({ top: 10, right: 20, left: 0, bottom: 0 });
  });

  it("TOOLTIP_STYLE has the required keys", () => {
    expect(TOOLTIP_STYLE).toHaveProperty("backgroundColor");
    expect(TOOLTIP_STYLE).toHaveProperty("border");
    expect(TOOLTIP_STYLE).toHaveProperty("borderRadius");
    expect(TOOLTIP_STYLE).toHaveProperty("fontSize");
    expect(TOOLTIP_STYLE).toHaveProperty("color");
    expect(TOOLTIP_STYLE).toHaveProperty("boxShadow");
  });

  it("TOOLTIP_LABEL_STYLE has the required keys", () => {
    expect(TOOLTIP_LABEL_STYLE).toHaveProperty("color");
    expect(TOOLTIP_LABEL_STYLE).toHaveProperty("marginBottom");
    expect(TOOLTIP_LABEL_STYLE).toHaveProperty("fontWeight", 600);
  });

  it("AXIS_TICK_STYLE has the correct fontSize", () => {
    expect(AXIS_TICK_STYLE).toHaveProperty("fontSize", 12);
    expect(AXIS_TICK_STYLE).toHaveProperty("fill");
  });

  it("LEGEND_STYLE has the required keys", () => {
    expect(LEGEND_STYLE).toHaveProperty("fontSize");
    expect(LEGEND_STYLE).toHaveProperty("color");
  });

  it("GRID_STROKE is a string", () => {
    expect(typeof GRID_STROKE).toBe("string");
  });
});