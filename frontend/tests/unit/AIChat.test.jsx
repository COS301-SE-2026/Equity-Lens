import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AIChat from "../../src/pages/AIChat/AIChat.jsx";
import useAuth from "../../src/hooks/useAuth.js";
import { getMockResponse } from "../../src/services/aiService.js";

vi.mock("../../src/hooks/useAuth.js");
vi.mock("../../src/services/aiService.js");

describe("AIChat", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: { full_name: "Bob Lane" } });
  });

  it("renders the page heading", () => {
    render(<AIChat />);
    expect(screen.getByRole("heading", { name: "AI Assistant" })).toBeDefined();
  });

  it("greets the user by first name when logged in", () => {
    render(<AIChat />);
    expect(screen.getByText("Hello Bob")).toBeDefined();
  });

  it("falls back to 'there' when no user is set", () => {
    useAuth.mockReturnValue({ user: null });
    render(<AIChat />);
    expect(screen.getByText("Hello there")).toBeDefined();
  });

  describe("when the user sends a message", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
      getMockResponse.mockReturnValue({ text: "mock reply" });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("adds the typed message to the conversation and clears input", () => {
      render(<AIChat />);
      const input = screen.getByPlaceholderText("Ask the assistant…");
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "what is NPN?" } });
      fireEvent.click(sendButton);

      expect(screen.getByText("what is NPN?")).toBeDefined();
      expect(input.value).toBe("");
    });

    it("disables the send button while the assistant is thinking", () => {
      render(<AIChat />);
      const input = screen.getByPlaceholderText("Ask the assistant…");
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "hi" } });
      fireEvent.click(sendButton);

      expect(sendButton.disabled).toBe(true);
    });

    it("renders the assistant's reply after the thinking delay", () => {
      render(<AIChat />);
      const input = screen.getByPlaceholderText("Ask the assistant…");
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "hi" } });
      fireEvent.click(sendButton);

      act(() => {
        vi.advanceTimersByTime(900);
      });

      expect(getMockResponse).toHaveBeenCalledWith("hi");
      expect(screen.getByText("mock reply")).toBeDefined();
    });

    it("ignores submissions that are empty or only whitespace", () => {
      render(<AIChat />);
      const input = screen.getByPlaceholderText("Ask the assistant…");
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.click(sendButton);

      expect(screen.getByText("Hello Bob")).toBeDefined();
      expect(screen.queryByRole("list")).toBeNull();
      expect(getMockResponse).not.toHaveBeenCalled();
    });

    it("renders the change text when the reply includes trend info", () => {
      getMockResponse.mockReturnValue({
        text: "MTN Group (MTN) is trading at R84.17, ",
        changeText: "2.05% on the day.",
        trend: "down",
      });

      render(<AIChat />);
      fireEvent.change(screen.getByPlaceholderText("Ask the assistant…"), {
        target: { value: "mtn" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      act(() => {
        vi.advanceTimersByTime(900);
      });

      expect(screen.getByText(/2\.05% on the day\./)).toBeDefined();
    });

    it("renders stock ticker cards when the reply includes them", () => {
      getMockResponse.mockReturnValue({
        text: "Here are your stock cards:",
        cards: [
          { ticker: "NPN", name: "Naspers", price: 3842.5, changePercent: 1.84 },
        ],
      });

      render(<AIChat />);
      fireEvent.change(screen.getByPlaceholderText("Ask the assistant…"), {
        target: { value: "cards" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      act(() => {
        vi.advanceTimersByTime(900);
      });

      expect(screen.getByText("NPN")).toBeDefined();
      expect(screen.getByText("Naspers")).toBeDefined();
    });
  });

  describe("suggested prompts", () => {
    it("renders all four suggested prompt buttons on first load", () => {
      render(<AIChat />);
      expect(screen.getByRole("button", { name: "Show all cards" })).toBeDefined();
      expect(screen.getByRole("button", { name: "How is MTN doing?" })).toBeDefined();
      expect(screen.getByRole("button", { name: "What's Sasol trading at?" })).toBeDefined();
      expect(
        screen.getByRole("button", {
          name: "How is my portfolio performing compared to the JSE benchmark?",
        })
      ).toBeDefined();
    });
  });
});
