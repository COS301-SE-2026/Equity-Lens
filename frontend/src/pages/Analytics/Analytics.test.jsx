import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from "@testing-library/react";
import Analytics from "./Analytics";
import useIndicators from "../../hooks/useIndicators";

vi.mock("../../hooks/useIndicators");

describe('Analytics', () => {
  beforeEach(() => {
    useIndicators.mockReturnValue({
      stockData: {},
      loading: false,
      error: null,
    });
  });

  it("shows the Analytics heading", () => {
    render(<Analytics />);
    expect(screen.getByRole("heading", { name: "Analytics" })).toBeInTheDocument();
  });

  it("shows the page description", () => {
    render(<Analytics />);
    expect(
      screen.getByText("Financial indicators calculated per holding - hover any label for an explanation")
    ).toBeInTheDocument();
  });

  it("shows the holdings count in the badge", () => {
    render(<Analytics />);
    expect(screen.getByText("0 holdings")).toBeInTheDocument();
  });

  it("reflects the number of stocks returned by useIndicators", () => {
    useIndicators.mockReturnValue({
      stockData: {
        AAPL: { loading: false, results: { ticker: "AAPL", name: "Apple Inc." } },
        MSFT: { loading: false, results: { ticker: "MSFT", name: "Microsoft Corp." } },
      },
      loading: false,
      error: null,
    });
    render(<Analytics />);
    expect(screen.getByText("2 holdings")).toBeInTheDocument();
  });

  it.skip("shows all indicator column labels", () => {
    render(<Analytics />);
    expect(screen.getAllByText("CAPM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("P/E Ratio").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Altman Z").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sharpe Ratio").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Beta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sortino Ratio").length).toBeGreaterThan(0);
    expect(screen.getAllByText("RSI").length).toBeGreaterThan(0);
  });
});
