import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CsvTable from "./CsvTable";

describe("This testing is for the CsvTable", () => 
{

  //in here to test if its empty
  it("shows message when no data is uploaded", () => {
    render(<CsvTable data={[]} />);

    expect(
      screen.getByText("No CSV data uploaded yet. Please can you upload a CSV file.")
    ).toBeInTheDocument();

  });


  //in here we will put mock data
  it("To show the title of that specific page", () => {
    const data = [
      {
        Asset: "Apple",
        Symbol: "AAPL",
        Quantity: "10",
        "Buy Price": "150"
      }
    ];

    render(<CsvTable data={data} />);

    expect(screen.getByText("Portfolio Data")).toBeInTheDocument();
  });


  it("To show the headers in the table", () => {
    const data = [
      {
        Asset: "Apple",
        Symbol: "AAPL",
        Quantity: "10",
        "Buy Price": "150"
      }
    ];

    render(<CsvTable data={data} />);

    expect(screen.getByText("Asset")).toBeInTheDocument();
    expect(screen.getByText("Symbol")).toBeInTheDocument();
    expect(screen.getByText("Quantity")).toBeInTheDocument();
    expect(screen.getByText("Buy Price")).toBeInTheDocument();
  });

  it("to show the data", () => {
    const data = [
      {
        Asset: "Apple",
        Symbol: "AAPL",
        Quantity: "10",
        "Buy Price": "150"
      }
    ];

    render(<CsvTable data={data} />);

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  //in here to test 
  it("in here to show more than one row", () => {
    const data = [
      {
        Asset: "Apple",
        Symbol: "AAPL",
        Quantity: "10",
        "Buy Price": "150"
      },
      {
        Asset: "test2",
        Symbol: "symboltest",
        Quantity: "5",
        "Buy Price": "200"
      }
    ];

    render(<CsvTable data={data} />);

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("test2")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("symboltest")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();

  });

  //if its null
  it("shows message when data is null", () => {
    render(<CsvTable data={null} />);

    expect(
      screen.getByText("No CSV data uploaded yet. Please can you upload a CSV file.")
    ).toBeInTheDocument();
  });

});