import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ThemeProvider } from "../../src/context/ThemeContext.jsx";
import ThemeToggle from "../../src/components/common/ThemeToggle/ThemeToggle.jsx";


describe("ThemeToggle integration", () => {

  //resetting shared state
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("clicking changes the label from light to dark mode", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    //simulate a user clicking the button
    fireEvent.click(screen.getByRole("button"));

    //label flips because the next click would switch us back out of dark
    expect(screen.getByLabelText("Switch to light mode")).toBeDefined();
  });

  it("clicking saves the new theme to localStorage", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole("button"));

    //page refresh keeps choice. It relies on this key being set
    expect(localStorage.getItem("theme")).toBe("dark");
  });

});
