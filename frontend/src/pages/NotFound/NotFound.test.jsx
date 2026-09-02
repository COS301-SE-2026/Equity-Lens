import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import NotFound from "./NotFound";


const renderNotFound = () => render(<NotFound />, { wrapper: MemoryRouter });

describe("This is testing the NotFound page", () => {

  it("in here it showes the  404 heading", () => {
    renderNotFound();

    expect(
      screen.getByText("404")
    ).toBeInTheDocument();
  });

  it("In here it showes the pages message", () => {
    renderNotFound();

    expect(
      screen.getByText("Page not found")
    ).toBeInTheDocument();
  });

  it("showes the description text", () => {
    renderNotFound();

    expect(
      screen.getByText(
        "The page you are looking for does not exist or has been moved."
      )
    ).toBeInTheDocument();
  });

  it("gives the user a way back instead of a dead end", () => {
    renderNotFound();

    expect(
      screen.getByRole("link", { name: /back to home/i })
    ).toBeInTheDocument();
  });

});