import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Example from "../../src/pages/Example/Example";


//The Name of the page
describe("Example", () => {

  //In here, what you are testing
  it("Test One", () => {
    //in here, we put that specific import
    render(<Example />);

    //in here you can check buttons etc...
    expect(screen.getByText("Example Page")).toBeDefined();
  });

});