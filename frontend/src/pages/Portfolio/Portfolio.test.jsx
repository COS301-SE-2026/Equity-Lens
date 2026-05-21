import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Portfolio from "./Portfolio";

describe("Portfolio", () => {

  it("to show the heading of that page", () => {
    render(<Portfolio />);

    expect(
      screen.getByText("Portfolio")
    ).toBeInTheDocument();
  });

  it("to show the portfolio description", () => {
    render(<Portfolio />);

    expect(
      screen.getByText(
        "Import and manage your investment holdings."
      )
    ).toBeInTheDocument();
  });

  //in here i just combined it with the other pages for testing such as the CsvUpload and the CsvTable component in frontend
  it("to show the csv upload heading", () => {
    render(<Portfolio />);

    expect(
      screen.getByText("Import CSV")
    ).toBeInTheDocument();
  });

  it("shows no data message initially", () => {
    render(<Portfolio />);

    expect(
      screen.getByText(
        "No CSV data uploaded yet. Please can you upload a CSV file."
      )
    ).toBeInTheDocument();
  });

});