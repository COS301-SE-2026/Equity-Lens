import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "./api"
import { getIndicatorData } from "./indicatorService";

vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("indicatorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("calls the cached indicators endpoint", async () => {
    api.get.mockResolvedValue({ data: []
    });
    await getIndicatorData();
    expect(api.get).toHaveBeenCalledWith("/indicators");
  });

  it("returns the backend response payload unchanged", async () => {
    const payload = [{ticker: "AAPL", name: "Apple Inc."}];
    api.get.mockResolvedValue({data: payload});
    await expect(getIndicatorData()).resolves.toBe(payload);
  });
});