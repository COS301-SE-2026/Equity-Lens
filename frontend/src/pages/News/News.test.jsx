import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NewsInvestment from "./News";

describe("NewsInvestment", () => {


  it("shows the heading", () => {

    render(<NewsInvestment />);

    expect(
      screen.getByText("Investment News")
    ).toBeInTheDocument();

  });


});