import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Example from "../../src/pages/Example/Example";

describe("Example Integration Test", () => {
  it("button click changes text", () => {
    render(<Example />);

    fireEvent.click(screen.getByText("Example Button"));

    expect(screen.getByText("Welcome User")).toBeDefined();
  });
});