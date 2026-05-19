import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import usePortfolio from "../../src/hooks/usePortfolio.js";
import { getMockPortfolioData } from "../../src/services/portfolioService.js";

vi.mock("../../src/services/portfolioService.js");

describe("usePortfolio", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("loads portfolio data and clears the loading flag", async () => {
    const fakeData = { summary: { total_value: 100 }, holdings: [] };
    getMockPortfolioData.mockReturnValue(fakeData);

    const { result } = renderHook(() => usePortfolio());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.portfolioData).toEqual(fakeData);
    expect(result.current.error).toBe(null);
  });

  it("sets an error message when the service throws", async () => {
    getMockPortfolioData.mockImplementation(() => {
      throw new Error("network down");
    });

    const { result } = renderHook(() => usePortfolio());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("network down");
    expect(result.current.portfolioData).toBe(null);
  });
});
