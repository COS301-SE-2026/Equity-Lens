import { render, screen, fireEvent} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AIChat from "./AIChat.jsx";
import useAuth from "../../hooks/useAuth.js";
import api from "../../services/api.js";
import { ChatProvider } from "../../context/ChatContext.jsx";
import { MemoryRouter } from "react-router-dom";


vi.mock("../../context/ThemeContext.jsx", () => ({
  useThemeContext: () => ({
    theme: "dark",
    toggleTheme: vi.fn(),
  }),
}));

vi.mock("../../hooks/useTheme.js", () => ({
  default: () => ({
    theme: "dark",
    toggleTheme: vi.fn(),
  }),
}));

vi.mock("../../hooks/useAuth.js");
vi.mock("../../services/api.js");

const mockUseAuth = /** @type {any} */(useAuth);
const mockGet = /** @type {any} */(api.get);
const mockPost = /** @type {any} */(api.post);


const renderChat = () =>
    render(
        <MemoryRouter>
            <ChatProvider>
                <AIChat />
            </ChatProvider>
        </MemoryRouter>
        
);


describe("AIChat", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({user: { full_name: "Bob Lane" }});
    mockGet.mockResolvedValue({data: []});
  });

  it("renders the page heading", () => {
    renderChat();
    expect(screen.getByRole("heading", { name: "AI Assistant" })).toBeDefined();
  });

  it("greets the user by first name when logged in", () => {
    renderChat();
    expect(screen.getByText("Hello Bob")).toBeDefined();
  });

  it("falls back to 'there' when no user is set", () => {
    mockUseAuth.mockReturnValue({user: null});
    renderChat();
    expect(screen.getByText("Hello there")).toBeDefined();
  });
    
  describe("when the user sends a message", () => {
    beforeEach(() => {
      vi.clearAllMocks();
        mockGet.mockResolvedValue({data: []});
        mockPost.mockResolvedValue({data: {reply: "mock reply", conversation_id: 1}});
    });

    it("adds the typed message to the conversation and clears input", () => {
      renderChat();
      const input = /**@type {HTMLInputElement} */ (screen.getByPlaceholderText("Ask the assistant..."));
      const sendButton = screen.getByRole("button", {name: /send/i})

      fireEvent.change(input, {target: {value: "what is NPN?"}});
      fireEvent.click(sendButton)

      expect(screen.getByText("what is NPN?")).toBeDefined();
      expect(input.value).toBe("");
    });

    it("disables the send button while the assistant is thinking", () => {
       renderChat();
       const input = screen.getByPlaceholderText("Ask the assistant...");
       const sendButton = /**@type {HTMLButtonElement} */(screen.getByRole("button", { name: /send/i }));

       fireEvent.change(input, { target: { value: "hi" } });
       fireEvent.click(sendButton);

       expect(sendButton.disabled).toBe(true);
     });

    it("renders the assistant's reply after the thinking delay", async () => {
      renderChat();
      const input = screen.getByPlaceholderText("Ask the assistant...");
      const sendButton = screen.getByRole("button", {name: /send/i});

      fireEvent.change(input, { target: { value: "hi" } });
      fireEvent.click(sendButton);

      expect(await screen.findByText("mock reply")).toBeDefined();
      expect(api.post).toHaveBeenCalledWith("/ai_chat/", {message: "hi", conversation_id: null});
    });

    it("ignores submissions that are empty or only whitespace", () => {
      renderChat();
      const input = screen.getByPlaceholderText("Ask the assistant...");
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.click(sendButton);

      expect(screen.getByText("Hello Bob")).toBeDefined();
      expect(screen.queryByRole("list")).toBeNull();
      expect(api.post).not.toHaveBeenCalled();
    });

    it("the send button gets enabled when a user types a letter into the text box.", () => {
      renderChat();
      const input = screen.getByPlaceholderText("Ask the assistant...");
      const sendButton = /**@type {HTMLButtonElement} */(screen.getByRole("button", {name: /send/i}));

      expect(sendButton.disabled).toBe(true);

      fireEvent.change(input, {target: {value: "hello"}});
      expect(sendButton.disabled).toBe(false);
    });
    
    it("loading indicator appears while waiting for a response from the assistant.", () => {
      renderChat();
      const input = screen.getByPlaceholderText("Ask the assistant...");
      const sendButton = /** @type {HTMLButtonElement} */ screen.getByRole("button", {name: /send/i});  
      
      fireEvent.change(input, {target: {value: "hello"}});
      fireEvent.click(sendButton);

      expect(sendButton.disabled).toBe(true);
    });
  });
});
