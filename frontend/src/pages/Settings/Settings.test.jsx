import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Settings from "./Settings";
import { useAuthContext } from "../../context/AuthContext";
import { deleteAccount } from "../../services/authService";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/constants";


vi.mock("../../context/AuthContext");
vi.mock("../../services/authService");
vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
}));


vi.mock("../../components/common/ThemeToggle/ThemeToggle", () => ({
  default: () => <button data-testid="theme-toggle">Theme Toggle</button>,
}));

describe("Settings Component", () => {
  const mockLogout = vi.fn();
  const mockNavigate = vi.fn();
  const mockUser = { email: "user@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthContext).mockReturnValue({
      user: mockUser,
      logout: mockLogout,
    });
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  it("renders page header, appearance section, and danger zone", () => {
    render(<Settings />);

    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText(/appearance/i)).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    expect(screen.getByText(/danger zone/i)).toBeInTheDocument();
    expect(screen.getByText(`Type your email (${mockUser.email}) to enable deletion`)).toBeInTheDocument();
  });

  describe("Delete Account Button enablement", () => {
    it("keeps the Delete Account button disabled when email input is empty or wrong", () => {
      render(<Settings />);
      const deleteBtn = screen.getByRole("button", { name: /delete account/i });
      const input = screen.getByPlaceholderText(mockUser.email);

      expect(deleteBtn).toBeDisabled();

      fireEvent.change(input, { target: { value: "wrong@example.com" } });
      expect(deleteBtn).toBeDisabled();
    });

    it("enables the Delete Account button when typed email matches user email (case-insensitive & trimmed)", () => {
      render(<Settings />);
      const deleteBtn = screen.getByRole("button", { name: /delete account/i });
      const input = screen.getByPlaceholderText(mockUser.email);

      fireEvent.change(input, { target: { value: " USER@EXAMPLE.COM " } });
      expect(deleteBtn).not.toBeDisabled();
    });
  });

  describe("DeleteAccountModal Flow", () => {
    beforeEach(() => {
      render(<Settings />);
      const input = screen.getByPlaceholderText(mockUser.email);
      fireEvent.change(input, { target: { value: mockUser.email } });
      
      const openModalBtn = screen.getByRole("button", { name: /delete account/i });
      fireEvent.click(openModalBtn);
    });

    it("opens the modal and displays warning items on confirmation step 1", () => {
      expect(screen.getByRole("heading", { name: /delete account/i })).toBeInTheDocument();
      expect(screen.getByText(/this will permanently delete:/i)).toBeInTheDocument();
      expect(screen.getByText(/your account and login credentials/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    });

    it("closes modal when 'Cancel' is clicked on step 1", () => {
      const cancelBtn = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelBtn);

      expect(screen.queryByRole("heading", { name: /delete account/i })).not.toBeInTheDocument();
    });

    it("transitions to step 2 when 'Continue' is clicked", () => {
      const continueBtn = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(continueBtn);

      expect(screen.getByText(/Are you absolutely sure/i)).toBeInTheDocument();
      expect(screen.getByText(mockUser.email)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /permanently delete/i })).toBeInTheDocument();
    });

    it("handles successful account deletion", async () => {
      vi.mocked(deleteAccount).mockResolvedValueOnce({});
    
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      const finalDeleteBtn = screen.getByRole("button", { name: /permanently delete/i });
      fireEvent.click(finalDeleteBtn);

      expect(finalDeleteBtn).toHaveTextContent(/deleting\.\.\./i);
      expect(deleteAccount).toHaveBeenCalledWith(mockUser.email);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith(ROUTES.HOME);
      });
    });

    it("displays error message if account deletion fails", async () => {
      const errorMessage = "Server error: Failed to delete account";
      vi.mocked(deleteAccount).mockRejectedValueOnce(new Error(errorMessage));

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      const finalDeleteBtn = screen.getByRole("button", { name: /permanently delete/i });
      fireEvent.click(finalDeleteBtn);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      expect(mockLogout).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});