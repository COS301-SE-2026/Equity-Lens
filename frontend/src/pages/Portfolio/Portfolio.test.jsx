import { describe, it, expect } from "vitest";
import { buildHoldingsPayload, parseExposureRow } from "./Portfolio";
const PARSED_ROWS = [
  { instrument_name: "Naspers Ltd", quantity: "10", total_cost: "173000.00" },
  { instrument_name: "Standard Bank Group Ltd", quantity: "200", total_cost: "35000.00" },
  { instrument_name: "Anglo American", quantity: "50", total_cost: "9000.00" },
  { instrument_name: "Sasol Ltd", quantity: "0", total_cost: "0.00" },
];

describe("buildHoldingsPayload", () => {
  it("leaves out a position closed during the period", () => {
    const payload = buildHoldingsPayload(PARSED_ROWS);

    expect(payload).toHaveLength(3);
    expect(payload.map((h) => h.instrument_name)).not.toContain("Sasol Ltd");
  });

  it("never sends a NaN cost price, which the schema rejects as null", () => {
    const payload = buildHoldingsPayload(PARSED_ROWS);

    for (const holding of payload) {
      expect(Number.isFinite(holding.cost_price)).toBe(true);
    }
  });

  it("weights the kept rows against each other so they still total 100%", () => {
    const payload = buildHoldingsPayload(PARSED_ROWS);
    const total = payload.reduce((sum, h) => sum + h.weight_percentage, 0);

    expect(total).toBeCloseTo(100, 6);
  });

  it("sends quantity as a number, the same as total_cost", () => {
    const [first] = buildHoldingsPayload(PARSED_ROWS);

    expect(first.quantity).toBe(10);
    expect(first.total_cost).toBe(173000);
    expect(first.cost_price).toBe(17300);
  });

  it("returns nothing rather than dividing by zero when every row is closed", () => {
    const allClosed = [{ instrument_name: "Sasol Ltd", quantity: "0", total_cost: "0.00" }];

    expect(buildHoldingsPayload(allClosed)).toEqual([]);
  });
});

describe("parseExposureRow", () => {
  const ROW = "Satrix S&P 500 Feeder ETF 15.6432 902.15 57.67 62.74 981.44 37.53%";

  it("puts Cost in total_cost and Qty in quantity", () => {
    const row = parseExposureRow(ROW);

    expect(row?.total_cost).toBe("902.15");
    expect(row?.quantity).toBe("15.6432");
  });

  it("takes the closing figures from Curr Price and Curr Value, not from Weight", () => {
    const row = parseExposureRow(ROW);

    expect(row?.statement_price).toBe("62.74");
    expect(row?.statement_value).toBe("981.44");
  });

  it("keeps the instrument name in front of the numbers", () => {
    expect(parseExposureRow(ROW)?.instrument_name).toBe("Satrix S&P 500 Feeder ETF");
  });

  it("returns null for the second line of a wrapped instrument name", () => {
    expect(parseExposureRow("Coreshares S&P Global Property")).toBeNull();
  });

  it("throws rather than import a row whose columns don't reconcile", () => {
    const extraColumn = "Satrix S&P 500 Feeder ETF 15.6432 902.15 57.67 62.74 981.44 5.99 37.53%";

    expect(() => parseExposureRow(extraColumn)).toThrow(/exposure columns/);
  });

  it("throws when the last column isn't a weight at all", () => {
    const noWeight = "Satrix S&P 500 Feeder ETF 15.6432 902.15 57.67 62.74 981.44 37.53";

    expect(() => parseExposureRow(noWeight)).toThrow(/exposure columns/);
  });
});