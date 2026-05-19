import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor
} from "@testing-library/react";

import CsvUpload from "./CsvUpload";

describe("This will be tetsing the CsvUpload", () => {

  it("this will show the import heading", () => {
    render(<CsvUpload onCsvValid={() => {}} />);

    expect(
      screen.getByText("Import CSV")
    ).toBeInTheDocument();
  });

  //The container, is all the html code that will be in that page
  it("This will check the file input", () => {
    const { container } = render(
      <CsvUpload onCsvValid={() => {}} />
    );

    const input = container.querySelector(
      'input[type="file"]'
    );

    expect(input).toBeInTheDocument();
  });

  it("shows error for wrong file type", async () => {
    render(<CsvUpload onCsvValid={() => {}} />);

    const file = new File(
      ["hello"],
      "test.txt",
      { type: "text/plain" }
    );

    const input = document.querySelector(
      'input[type="file"]'
    );

    fireEvent.change(input, {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Sorry, Please make sure that it's a csv file."
        )
      ).toBeInTheDocument();
    });
  });

});