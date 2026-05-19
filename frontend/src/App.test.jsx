import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import App from "./App";

describe("App", () => {

  it("renders app correctly", () => {
    const { container } = render(<App />);

    expect(container).toBeTruthy();
  });

});