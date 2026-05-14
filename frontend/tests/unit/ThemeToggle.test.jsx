import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ThemeProvider } from "../../src/context/ThemeContext.jsx";
import ThemeToggle from "../../src/components/common/ThemeToggle/ThemeToggle.jsx";


//The Name of the component
describe("Should toggle theme", () => {

  //this just resets the local storage for each test so no interference
  beforeEach(() => {
    localStorage.clear();
  });

  //In here, what you are testing
  it("renders a button with in light mode by default", () => {
    //in here, we put that specific import
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    //in here you can check buttons etc...
    expect(screen.getByLabelText("Switch to dark mode")).toBeDefined();
  });

  it("renders in dark mode when localstorage is set to dark for the theme", () => {
    //simulate where user already has it in dark mode
    localStorage.setItem("theme", "dark");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    //button should show the dark mode label
    expect(screen.getByLabelText("Switch to light mode")).toBeDefined();
  });

  it("shows the light icon by default", () => {

    
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    //src should point to the sun (light mode) icon
    const icon = screen.getByRole("button").querySelector("img");
    expect(icon.src).toContain("light.png");
  });

  it("shows the dark icon when it is in dark mode", () => {
    localStorage.setItem("theme", "dark");
    
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    //src should point to the sun (light mode) icon
    const icon = screen.getByRole("button").querySelector("img");
    expect(icon.src).toContain("dark.png");
  });  

});
