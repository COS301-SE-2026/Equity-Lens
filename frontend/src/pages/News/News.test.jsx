import {render, screen, waitFor, within} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import {describe, it, expect, vi, beforeEach} from "vitest";
import api from "../../services/api";
import NewsInvestment from "./News";


vi.mock("../../services/api", () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
    },
}));

const mockGet = /**@type {any} */ (api.get);
const mockPost = /**@type {any} */ (api.post);

const businessArticles = [
  {
    article_id: "n1",
    title: "Markets rally on rate cut hopes",
    description: "Local equities closed higher across the board.",
    pubDate: "2026-07-15 09:00:00",
    source_name: "Business Day",
    image_url: "https://example.com/rally.jpg",
    category: ["business"]
  },
];

const newsResponse = {
  data: {
    results: businessArticles,
    positive: 4,
    negative: 2,
    neutral: 1,
    total_articles: 7
  },
};

const watchlistResponse = {
  data: {
    watchlist: [
      {
        id: "w1",
        ticker: "AAPL",
        company_name: "Apple Inc",
        current_price: 215.5,
        change_percent: 2.15
      }
    ],
    highest: {ticker: "AAPL", sector: "Technology", change_percent: 2.15},
    lowest: {ticker: "TSLA", sector: "Automotive", change_percent: -1.35}
  }
};

/**
 * @param {string} ticker
 */
const tickerNews = (ticker) => ({
  data: {
    articles: [
      {
        uuid: `${ticker}-1`,
        title: `${ticker} beats expectations`,
        description: "Quarterly earnings came in ahead of forecast.",
        image_url: "https://example.com/up.jpg",
        published_at: "2026-07-14",
        source: "Reuters",
        entities: [{ symbol: ticker, sentiment_score: 0.62 }]
      },
      {
        uuid: `${ticker}-2`,
        title: `${ticker} faces supply issues`,
        description: "Component shortages continue into the next quarter.",
        image_url: "https://example.com/down.jpg",
        published_at: "2026-07-13",
        source: "Bloomberg",
        entities: [{symbol: ticker, sentiment_score: -0.41}]
      },
      {
        uuid: `${ticker}-3`,
        title: `${ticker} holds steady`,
        description: "No material change to guidance.",
        image_url: "https://example.com/flat.jpg",
        published_at: "2026-07-12",
        source: "Moneyweb",
        entities: [{symbol: ticker, sentiment_score: 0}]
      }
    ],
    positive: 1, negative: 1, neutral: 1, total_articles: 3
  }
});

/**
 * @param {string} label
 */
const statCard = (label) =>
  /** @type {HTMLElement} */ (screen.getByText(label).parentElement);

describe("News page", () => {
    beforeEach(() => {
      mockGet.mockImplementation((/** @type {string} */ url) => {
        if (url === "/news/portfolio-tickers") {
          return Promise.resolve({ data: { tickers: ["AAPL", "MSFT"] } });
        }
        if (url === "/watchlist/") {
          return Promise.resolve(watchlistResponse);
        }
        if (url.startsWith("/news/test-aapl/")) {
          return Promise.resolve(tickerNews(String(url.split("/").pop())));
        }
        if (url.startsWith("/news/?category=")) {
          return Promise.resolve(newsResponse);
        }
        return Promise.resolve({ data: {} });
      });
      mockPost.mockResolvedValue({ data: {} });
    });

    it("renders the page heading and description", async () => {
        render(<NewsInvestment />);

        expect(screen.getByRole("heading", {level: 1, name: "Investment News"})).toBeInTheDocument();
        expect(screen.getByText("Stay updated with the latest market news and insights")).toBeInTheDocument();

        await screen.findByText("Markets rally on rate cut hopes");
    });

    it("loads portfolio tickers, business news and the watchlist on mount", async () => {
        render(<NewsInvestment />);

        await waitFor(() => {
            expect(mockGet).toHaveBeenCalledWith("/news/portfolio-tickers");
            expect(mockGet).toHaveBeenCalledWith("/news/?category=business");
            expect(mockGet).toHaveBeenCalledWith("/watchlist/");
        });
    });

    it("shows summary cards from the news response", async () => {
        render(<NewsInvestment />);

        await screen.findByText("Markets rally on rate cut hopes");

        expect(within(statCard("Relevant Articles")).getByText("7")).toBeInTheDocument();
        expect(within(statCard("Positive Impact")).getByText("4")).toBeInTheDocument();
        expect(within(statCard("Negative Impact")).getByText("2")).toBeInTheDocument();
        expect(within(statCard("Neutral Impact")).getByText("1")).toBeInTheDocument();
    });

    it("renders a filter button for every portfolio ticker", async () => {
        render(<NewsInvestment />);

        expect(await screen.findByRole("button", {name: "AAPL"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "MSFT"})).toBeInTheDocument();
    });

    it("renders article title, description, date and source in the feed", async () => {
        render(<NewsInvestment />);

    expect(await screen.findByText("Markets rally on rate cut hopes")).toBeInTheDocument();
    expect(screen.getByText("Local equities closed higher across the board.")).toBeInTheDocument();
    expect(screen.getByText("2026-07-15 09:00:00")).toBeInTheDocument();
    expect(screen.getByText("Business Day")).toBeInTheDocument();
});

    it("fetches ticker news and maps each sentiment score to a label", async () => {
        const user = userEvent.setup();
        render(<NewsInvestment />);

        await user.click(await screen.findByRole("button", {name: "AAPL" }));

        expect(mockGet).toHaveBeenCalledWith("/news/test-aapl/AAPL");
        expect(await screen.findByText("AAPL beats expectations")).toBeInTheDocument();

        expect(screen.getByText("positive")).toBeInTheDocument();
        expect(screen.getByText("negative")).toBeInTheDocument();
        expect(screen.getByText("neutral")).toBeInTheDocument();
    });

    it("filters the feed down to negative articles", async () => {
        const user = userEvent.setup();
        render(<NewsInvestment />);

        await user.click(await screen.findByRole("button", {name: "AAPL"}));
        await screen.findByText("AAPL beats expectations");

        await user.click(screen.getByRole("button", {name: "Negative"}));

        expect(screen.getByText("AAPL faces supply issues")).toBeInTheDocument();
        expect(screen.queryByText("AAPL beats expectations")).not.toBeInTheDocument();
        expect(screen.queryByText("AAPL holds steady")).not.toBeInTheDocument();
    });

    it("aggregates news across every ticker when All is pressed", async () => {
        const user = userEvent.setup();
        render(<NewsInvestment />);

        await screen.findByRole("button", { name: "AAPL" });
        mockGet.mockClear();

        const allFilterBtn = screen.getByRole("button", { name: /^\s*All\s*$/i });
        await user.click(allFilterBtn);

        await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith("/news/test-aapl/AAPL");
        expect(mockGet).toHaveBeenCalledWith("/news/test-aapl/MSFT");
        });
        expect(await screen.findByText("MSFT beats expectations")).toBeInTheDocument();
    });

    it("now switches to the market tab and swaps thel heading", async () => {
        const user = userEvent.setup();
        render(<NewsInvestment />);

        await screen.findByText("Portfolio News");
        await user.click(screen.getByRole("button", { name: /All Market/ }));

        expect(await screen.findByText("Market News")).toBeInTheDocument();
        expect(screen.queryByText("Portfolio News")).not.toBeInTheDocument();
        expect(mockGet).toHaveBeenCalledWith("/news/?category=business");
    });

    it("requests the matching endpoint for each of the market types", async () => {
        const user = userEvent.setup();
        render(<NewsInvestment />);

        await user.click(screen.getByRole("button", { name: /All Market/ }));
        await screen.findByText("Market News");

        await user.click(screen.getByRole("button", { name: "Top" }));
        expect(mockGet).toHaveBeenCalledWith("/news/?category=Top");

        await user.click(screen.getByRole("button", { name: "Technology" }));
        expect(mockGet).toHaveBeenCalledWith("/news/?category=Technology");

        await user.click(screen.getByRole("button", { name: "Politics" }));
        expect(mockGet).toHaveBeenCalledWith("/news/?category=Politics");

        await user.click(screen.getByRole("button", { name: "Crime" }));
        expect(mockGet).toHaveBeenCalledWith("/news/?category=Crime");

        const [categoryAll] = screen.getAllByRole("button", { name: "All" });
        await user.click(categoryAll);
        expect(mockGet).toHaveBeenCalledWith("/news/?category=All");
    });

    it("returns to portfolio", async () => {
        const user = userEvent.setup();
        render(<NewsInvestment />);

        await user.click(screen.getByRole("button", { name: /All Market/ }));
        await screen.findByText("Market News");

        await user.click(screen.getByRole("button", { name: /My portfolio/ }));

        expect(await screen.findByText("Portfolio News")).toBeInTheDocument();
        expect(screen.queryByText("Market News")).not.toBeInTheDocument();
    });
});