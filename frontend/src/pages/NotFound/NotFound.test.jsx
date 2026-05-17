import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import NotFound from "./NotFound";



describe("This is testing the NotFound page", () => {

  it("in here it showes the  404 heading", () => {
    render(
        <NotFound />
    );

    expect(
      screen.getByText("404")
    ).toBeInTheDocument();
  });

  it("In here it showes the pages message", () => {
    render(
        <NotFound />
    );

    expect(
      screen.getByText("Page not found")
    ).toBeInTheDocument();
  });

  it("showes the description text", () => {
    render(
        <NotFound />
    );

    expect(
      screen.getByText(
        "The page you are looking for does not exist or has been moved."
      )
    ).toBeInTheDocument();
  });

});