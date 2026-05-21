import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ThemeProvider } from "../../src/context/ThemeContext.jsx";
import ThemeToggle from "../../src/components/common/ThemeToggle/ThemeToggle.jsx";

describe("Should toggle theme", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a button in light mode by default", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    expect(screen.getByLabelText("Switch to dark mode")).toBeDefined();
  });

  it("renders in dark mode when localStorage is set to dark", () => {
    localStorage.setItem("equitylens_theme", "dark");
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    expect(screen.getByLabelText("Switch to light mode")).toBeDefined();
  });

  it("shows the light icon by default", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    const icon = screen.getByRole("button").querySelector("img");
    expect(icon.src).toContain("light.png");
  });

  it("shows the dark icon when in dark mode", () => {
    localStorage.setItem("equitylens_theme", "dark");
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    const icon = screen.getByRole("button").querySelector("img");
    expect(icon.src).toContain("dark.png");
  });
});