import { describe, it, expect } from "vitest";
import { getMockIndicatorData } from "./indicatorService";

describe("getMockIndicatorData", () => {
  it("returns an array of 2 stocks", () => {
    expect(getMockIndicatorData()).toHaveLength(2);
  });

  it("returns NPN as the first stock", () => {
    const data = getMockIndicatorData();
    expect(data[0].ticker).toBe("NPN");
    expect(data[0].name).toBe("Naspers");
  });

  it("returns MTN as the second stock", () => {
    const data = getMockIndicatorData();
    expect(data[1].ticker).toBe("MTN");
    expect(data[1].name).toBe("MTN Group");
  });

  it("each stock has all required indicator keys", () => {
    const requiredKeys = ["capm", "pe_ratio", "altman_z", "sharpe", "beta", "sortino", "rsi"];
    getMockIndicatorData().forEach((stock) => {
      requiredKeys.forEach((key) => {
        expect(stock).toHaveProperty(key);
      });
    });
  });

  it("each indicator has a value and unit", () => {
    getMockIndicatorData().forEach((stock) => {
      Object.entries(stock).forEach(([key, val]) => {
        if (key === "ticker" || key === "name") return;
        expect(val).toHaveProperty("value");
        expect(val).toHaveProperty("unit");
      });
    });
  });

  it("returns a new array on each call", () => {
    expect(getMockIndicatorData()).not.toBe(getMockIndicatorData());
  });
});