import { describe, it, expect } from 'vitest';
import { render, screen } from "@testing-library/react";
import Analytics from "./Analytics";
describe.skip('Analytics', () => {
    it("shows the Analytics heading", () => {
    render(<Analytics />);
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  it("shows the page description", () => {
    render(<Analytics />);
    expect(
      screen.getByText("Financial indicators calculated per holding — hover any label for an explanation")
    ).toBeInTheDocument();
  });

  it("shows the holdings badge", () => {
    render(<Analytics />);
    expect(screen.getByText(/holdings/)).toBeInTheDocument();
  });

  it("shows all indicator column labels", () => {
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
