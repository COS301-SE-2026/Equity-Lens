import { render, screen, fireEvent} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AIChat from "./AIChat.jsx";
import useAuth from "../../hooks/useAuth.js";
import api from "../../services/api.js";

vi.mock("../../hooks/useAuth.js");
vi.mock("../../services/api.js");

const mockUseAuth = /** @type {any} */(useAuth);
const mockGet = /** @type {any} */(api.get);
const mockPost = /** @type {any} */(api.post);

describe("AIChat", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({user: { full_name: "Bob Lane" }});
    mockGet.mockResolvedValue({data: []});
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
    mockUseAuth.mockReturnValue({user: null});
    render(<AIChat />);
    expect(screen.getByText("Hello there")).toBeDefined();
  });

  describe("when the user sends a message", () => {
    beforeEach(() => {
      vi.clearAllMocks();
        mockGet.mockResolvedValue({data: []});
        mockPost.mockResolvedValue({data: {reply: "mock reply", conversation_id: 1}});
    });

    it("adds the typed message to the conversation and clears input", () => {
      render(<AIChat />);
      const input = /**@type {HTMLInputElement} */ (screen.getByPlaceholderText("Ask the assistant..."));
      const sendButton = screen.getByRole("button", {name: /send/i})

      fireEvent.change(input, {target: {value: "what is NPN?"}});
      fireEvent.click(sendButton)

      expect(screen.getByText("what is NPN?")).toBeDefined();
      expect(input.value).toBe("");
    });

    it("disables the send button while the assistant is thinking", () => {
       render(<AIChat />);
       const input = screen.getByPlaceholderText("Ask the assistant...");
       const sendButton = /**@type {HTMLButtonElement} */(screen.getByRole("button", { name: /send/i }));

       fireEvent.change(input, { target: { value: "hi" } });
       fireEvent.click(sendButton);

       expect(sendButton.disabled).toBe(true);
     });

    it("renders the assistant's reply after the thinking delay", async () => {
      render(<AIChat/>)
      const input = screen.getByPlaceholderText("Ask the assistant...");
      const sendButton = screen.getByRole("button", {name: /send/i});

      fireEvent.change(input, { target: { value: "hi" } });
      fireEvent.click(sendButton);

      expect(await screen.findByText("mock reply")).toBeDefined();
      expect(api.post).toHaveBeenCalledWith("/ai_chat/", {message: "hi", conversation_id: null});
    });

    it("ignores submissions that are empty or only whitespace", () => {
      render(<AIChat />);
      const input = screen.getByPlaceholderText("Ask the assistant...");
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.click(sendButton);

      expect(screen.getByText("Hello Bob")).toBeDefined();
      expect(screen.queryByRole("list")).toBeNull();
      expect(api.post).not.toHaveBeenCalled();
    });

    it("the send button gets enabled when a user types a letter into the text box.", () => {
      render(<AIChat/>);
      const input = screen.getByPlaceholderText("Ask the assistant...");
      const sendButton = /**@type {HTMLButtonElement} */(screen.getByRole("button", {name: /send/i}));

      expect(sendButton.disabled).toBe(true);

      fireEvent.change(input, {target: {value: "hello"}});
      expect(sendButton.disabled).toBe(false);
    })
    
    it("loading indicator appears while waiting for a response from the assistant.", () => {
      render(<AIChat />);
      const input = screen.getByPlaceholderText("Ask the assistant...");
      const sendButton = screen.getByRole("button", {name: /send/i});  
      
      fireEvent.change(input, {target: {value: "hello"}});
      fireEvent.click(sendButton);

      expect(document.querySelectorAll(".animate-bounce").length).toBe(3);
    });

  describe("suggested prompts", () => {
    it("Renders all three suggested prompts to the user when they first click the page or start a new chat", () => {
      render(<AIChat/>);
      expect(screen.getByRole("button", {name: "How is MTN doing?"})).toBeDefined();
      expect(screen.getByRole("button", {name: "What's Sasol trading at?"})).toBeDefined();
      expect(screen.getByRole("button", {name: "How is my portfolio performing compared to the JSE benchmark?"})).toBeDefined();
    });
  
    it("Sends the prompt when it is clicked", async () => {
      mockPost.mockResolvedValue({data: {reply: "mock reply", conversation_id: 1}});
      render(<AIChat/>);
      fireEvent.click(screen.getByRole("button", {name: "How is MTN doing?"}));

      expect(screen.getByText("How is MTN doing?")).toBeDefined();
      expect(api.post).toHaveBeenCalledWith("/ai_chat/", {message: "How is MTN doing?", conversation_id: null});
      })
    });
  });
});
