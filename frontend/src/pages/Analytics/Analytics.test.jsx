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

  it("shows all indicator column labels for each stock row", () => {
    useIndicators.mockReturnValue({
      stockData: {
        AAPL: { loading: false, results: { ticker: "AAPL", name: "Apple Inc." } },
      },
      loading: false,
      error: null,
    });
    render(<Analytics />);
    expect(screen.getByText("CAPM")).toBeInTheDocument();
    expect(screen.getByText("P/E Ratio")).toBeInTheDocument();
    expect(screen.getByText("Altman Z")).toBeInTheDocument();
    expect(screen.getByText("Sharpe Ratio")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Sortino Ratio")).toBeInTheDocument();
    expect(screen.getByText("RSI")).toBeInTheDocument();
  });
});
