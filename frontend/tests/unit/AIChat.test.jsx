import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AIChat from "../../src/pages/AIChat/AIChat.jsx";
import useAuth from "../../src/hooks/useAuth.js";

vi.mock("../../src/hooks/useAuth.js");

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
});
