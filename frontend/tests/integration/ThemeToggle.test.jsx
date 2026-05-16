import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ThemeProvider } from "../../src/context/ThemeContext.jsx";
import ThemeToggle from "../../src/components/common/ThemeToggle/ThemeToggle.jsx";

describe("ThemeToggle integration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("toggles from light to dark when clicked", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    const button = screen.getByRole("button");
    expect(screen.getByLabelText("Switch to dark mode")).toBeDefined();
    fireEvent.click(button);
    expect(screen.getByLabelText("Switch to light mode")).toBeDefined();
  });

  it("toggles from dark to light when clicked", () => {
    localStorage.setItem("equitylens_theme", "dark");
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    const button = screen.getByRole("button");
    expect(screen.getByLabelText("Switch to light mode")).toBeDefined();
    fireEvent.click(button);
    expect(screen.getByLabelText("Switch to dark mode")).toBeDefined();
  });
});