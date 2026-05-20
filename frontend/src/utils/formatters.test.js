import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatPercent,
  formatShortCurrency,
  formatMonthYear,
  formatNumber,
} from "./formatters";

describe("chartFormatters", () => {
  describe("formatCurrency", () => {
    it("formats a positive value in ZAR", () => {
      expect(formatCurrency(1000)).toContain("1\u00a0000,00");
    });

    it("formats zero", () => {
      expect(formatCurrency(0)).toContain("0,00");
    });

    it("includes the ZAR currency symbol", () => {
      expect(formatCurrency(500)).toContain("R");
    });
  });

  describe("formatPercent", () => {
    it("prefixes positive values with a plus sign", () => {
      expect(formatPercent(5.5)).toBe("+5.50%");
    });

    it("does not prefix negative values with a plus sign", () => {
      expect(formatPercent(-3.2)).toBe("-3.20%");
    });

    it("formats zero with a plus sign", () => {
      expect(formatPercent(0)).toBe("+0.00%");
    });

    it("rounds to 2 decimal places", () => {
      expect(formatPercent(1.2345)).toBe("+1.23%");
    });
  });

  describe("formatShortCurrency", () => {
    it("divides by 1000 and appends k", () => {
      expect(formatShortCurrency(5000)).toBe("R 5k");
    });

    it("rounds to 0 decimal places", () => {
      expect(formatShortCurrency(5500)).toBe("R 6k");
    });

    it("formats large values correctly", () => {
      expect(formatShortCurrency(100000)).toBe("R 100k");
    });
  });

  describe("formatMonthYear", () => {
    it("formats a date string to short month and year", () => {
      expect(formatMonthYear("2024-01")).toBe("Jan 2024");
    });

    it("formats December correctly", () => {
      expect(formatMonthYear("2023-12")).toBe("Dec 2023");
    });

    it("formats mid-year months correctly", () => {
      expect(formatMonthYear("2024-06")).toBe("Jun 2024");
    });
  });

  describe("formatNumber", () => {
    it("formats a number with locale separators", () => {
      expect(formatNumber(1000)).toBe("1\u00a0000");
    });

    it("formats zero", () => {
      expect(formatNumber(0)).toBe("0");
    });

    it("formats large numbers", () => {
      expect(formatNumber(1000000)).toBe("1\u00a0000\u00a0000");
    });
  });
});