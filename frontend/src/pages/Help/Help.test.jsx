import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import Help from "./Help";

const loadPage = () =>
  render(
    <MemoryRouter>
      <Help />
    </MemoryRouter>,
  );

describe("Help page", () => {
    it("renders the page heading and intro copy", () => {
        loadPage();

        expect(screen.getByRole("heading", { level: 1, name: "Help Center" })).toBeInTheDocument();
        expect(screen.getByText("Find guides, answers and useful resources for EquityLens")).toBeInTheDocument();
    });

    it("renders the three section headings", () => {
      loadPage();

      expect(screen.getByRole("heading", { level: 2, name: "How can we help" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: "Frequently Asked Questions" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: "Resources" })).toBeInTheDocument();
    });

    it("renders every navigation card and resource link", () => {
        loadPage();

        expect(screen.getAllByRole("link")).toHaveLength(7);

        expect(screen.getByRole("link", { name: /Getting Started/ })).toHaveAttribute("href", "/dashboard");
        expect(screen.getByRole("link", { name: /Import data/ })).toHaveAttribute("href", "/portfolio");
        expect(screen.getByRole("link", { name: /Understand your Portfolio/ })).toHaveAttribute("href", "/analytics");
        expect(screen.getByRole("link", { name: /News & Market/ })).toHaveAttribute("href", "/news");
    });

    it("links the resources to the template download and support mailbox", () => {
        loadPage();

        expect(screen.getByRole("link", { name: /Portfolio Template/ })).toHaveAttribute("href", "/template/EquityLens_Portfolio_Excel_Template.xlsx");
        expect(screen.getByRole("link", { name: /Contact support/ })).toHaveAttribute("href", "mailto:thebigfivetb5@gmail.com");
    });

    it("renders the quick tip panel", () => {
        loadPage();

      expect(screen.getByText("Quick Tip")).toBeInTheDocument();
      expect(screen.getByText("Hover over charts and graphs to view more information about your portfolio data.")).toBeInTheDocument();
    });

    it("renders a collapsed button for every FAQ entry", () => {
        loadPage();

        expect(screen.getAllByRole("button")).toHaveLength(8);
        expect(screen.queryByText("Excel by following the template and PDF")).not.toBeInTheDocument();
    });

    it("expands an FAQ answer on click and collapses it again", async () => {
        const user = userEvent.setup();
        loadPage();

        const question = screen.getByRole("button", {
            name: "Which file formats can I upload?",
        });

        await user.click(question);
        expect(screen.getByText("Excel by following the template and PDF")).toBeInTheDocument();

        await user.click(question);
        expect(screen.queryByText("Excel by following the template and PDF")).not.toBeInTheDocument();
    });

    it("keeps only one FAQ answer open at a time", async () => {
        const user = userEvent.setup();
        loadPage();

        await user.click(screen.getByRole("button", { name: "Which file formats can I upload?" }));
        expect(screen.getByText("Excel by following the template and PDF")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Can the AI Assistant see my portfolio?" }));

        expect(screen.getByText("Yes, it uses your uploaded portfolio and replies are based off of those.")).toBeInTheDocument();
        expect(screen.queryByText("Excel by following the template and PDF")).not.toBeInTheDocument();
    });
});