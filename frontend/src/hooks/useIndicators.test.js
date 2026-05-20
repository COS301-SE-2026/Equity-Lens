import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import useIndicators from "./useIndicators";

vi.mock("../services/indicatorService", () => ({
  getMockIndicatorData: vi.fn(),
}));
import { getMockIndicatorData } from "../services/indicatorService";

const mockStocks = [
  { ticker: "AAPL", name: "Apple Inc." },
  { ticker: "MSFT", name: "Microsoft Corp." },
];

beforeEach(() => {
  vi.clearAllMocks();
  getMockIndicatorData.mockReturnValue(mockStocks);
});

describe("useIndicators", () => {
  

  it("returns stockData keyed by ticker after loading", async () => {
    const { result } = renderHook(() => useIndicators());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stockData).toHaveProperty("AAPL");
    expect(result.current.stockData).toHaveProperty("MSFT");
  });

  it("maps each stock into a results object", async () => {
    const { result } = renderHook(() => useIndicators());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stockData["AAPL"].results).toEqual(mockStocks[0]);
    expect(result.current.stockData["AAPL"].loading).toBe(false);
  });

  it("has no error on successful fetch", async () => {
    const { result } = renderHook(() => useIndicators());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it("sets error when getMockIndicatorData throws", async () => {
    getMockIndicatorData.mockImplementation(() => {
      throw new Error("Service failed");
    });
    const { result } = renderHook(() => useIndicators());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Service failed");
  });

  it("sets a fallback error message when the error has no message", async () => {
    getMockIndicatorData.mockImplementation(() => {
      throw {};
    });
    const { result } = renderHook(() => useIndicators());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load indicators");
  });
});