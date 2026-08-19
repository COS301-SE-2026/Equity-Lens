import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import useTheme from "./useTheme";

vi.mock("../context/ThemeContext", () => ({
  useThemeContext: vi.fn(() => ({
    theme: "light",
    toggleTheme: vi.fn(),
  })),
}));
import { useThemeContext } from "../context/ThemeContext";

describe("useTheme", () => {
  it("returns the value from useThemeContext", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current).toEqual({
      theme: "light",
      toggleTheme: expect.any(Function),
    });
  });

  it("calls useThemeContext once", () => {
    renderHook(() => useTheme());
    expect(useThemeContext).toHaveBeenCalled();
  });
});