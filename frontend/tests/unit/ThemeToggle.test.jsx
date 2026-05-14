import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ThemeProvider } from "../../src/context/ThemeContext.jsx";
import ThemeToggle from "../../src/components/common/ThemeToggle/ThemeToggle.jsx";


//The Name of the component
describe("Should toggle theme", () => {

  //In here, what you are testing
  it("renders a button with in light mode by default", () => {
    //localStorage starts empty, so initial state is light mode
    localStorage.clear();

    //in here, we put that specific import
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    //in here you can check buttons etc...
    expect(screen.getByLabelText("Switch to dark mode")).toBeDefined();
  });

});
