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
 * @param {number} n
 * @param {string} sentiment
 */
const portfolioArticle = (ticker, n, sentiment) => ({
  article_id: `${ticker}-${n}`,
  title: {
    1: `${ticker} beats expectations`,
    2: `${ticker} faces supply issues`,
    3: `${ticker} holds steady`,
  }[n],
  description: "Quarterly earnings came in ahead of forecast.",
  image_url: "https://example.com/up.jpg",
  pubDate: "2026-07-14",
  source_name: "Reuters",
  category: [ticker],
  sentiment,
  sentiment_score: 0.62,
});

// the server does the entity/sentiment mapping now, so this is the mapped shape the page
// renders straight out of /news/portfolio
const portfolioNews = {
  data: {
    results: [
      portfolioArticle("AAPL", 1, "positive"),
      portfolioArticle("AAPL", 2, "negative"),
      portfolioArticle("AAPL", 3, "neutral"),
      portfolioArticle("MSFT", 1, "positive"),
    ],
    positive: 2, negative: 1, neutral: 1, total_articles: 4
  }
};

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
        if (url === "/news/portfolio") {
          return Promise.resolve(portfolioNews);
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

        await screen.findByText("AAPL beats expectations");
    });

    it("loads the portfolio feed, its tickers and the watchlist on mount", async () => {
        render(<NewsInvestment />);

        await waitFor(() => {
            expect(mockGet).toHaveBeenCalledWith("/news/portfolio-tickers");
            expect(mockGet).toHaveBeenCalledWith("/news/portfolio");
            expect(mockGet).toHaveBeenCalledWith("/watchlist/");
        });

        // market news is the other tab's feed and shares the articles state - loading it
        // here too meant two writers racing over what the portfolio tab displayed
        expect(mockGet).not.toHaveBeenCalledWith("/news/?category=business");
    });

    it("shows summary cards from the news response", async () => {
        render(<NewsInvestment />);

        await screen.findByText("AAPL beats expectations");

        expect(within(statCard("Relevant Articles")).getByText("4")).toBeInTheDocument();
        expect(within(statCard("Positive Impact")).getByText("2")).toBeInTheDocument();
        expect(within(statCard("Negative Impact")).getByText("1")).toBeInTheDocument();
        expect(within(statCard("Neutral Impact")).getByText("1")).toBeInTheDocument();
    });

    it("renders a filter button for every portfolio ticker", async () => {
        render(<NewsInvestment />);

        expect(await screen.findByRole("button", {name: "AAPL"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "MSFT"})).toBeInTheDocument();
    });

    it("renders article title, description, date and source in the feed", async () => {
        render(<NewsInvestment />);

    expect(await screen.findByText("AAPL beats expectations")).toBeInTheDocument();
    expect(screen.getAllByText("Quarterly earnings came in ahead of forecast.").length).toBe(4);
    expect(screen.getAllByText("2026-07-14").length).toBe(4);
    expect(screen.getAllByText("Reuters").length).toBe(4);
});

    it("filters to one ticker without going back to the server", async () => {
        const user = userEvent.setup();
        render(<NewsInvestment />);

        await screen.findByText("MSFT beats expectations");
        const callsBefore = mockGet.mock.calls.length;

        await user.click(screen.getByRole("button", {name: "AAPL"}));

        // the chips used to fire a marketaux call each - once per click, per user
        expect(mockGet.mock.calls.length).toBe(callsBefore);
        expect(screen.getByText("AAPL beats expectations")).toBeInTheDocument();
        expect(screen.queryByText("MSFT beats expectations")).not.toBeInTheDocument();

        expect(screen.getByText("positive")).toBeInTheDocument();
        expect(screen.getByText("negative")).toBeInTheDocument();
        expect(screen.getByText("neutral")).toBeInTheDocument();
    });

    it("the All chip puts every ticker back in the feed", async () => {
        const user = userEvent.setup();
        render(<NewsInvestment />);

        await user.click(await screen.findByRole("button", {name: "AAPL"}));
        expect(screen.queryByText("MSFT beats expectations")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", {name: "All"}));

        expect(screen.getByText("MSFT beats expectations")).toBeInTheDocument();
    });

    it("filters the feed down to negative articles", async () => {
        const user = userEvent.setup();
        render(<NewsInvestment />);

        await user.click(await screen.findByRole("button", {name: "AAPL"}));

        await user.click(screen.getByRole("button", {name: "Negative"}));

        expect(screen.getByText("AAPL faces supply issues")).toBeInTheDocument();
        expect(screen.queryByText("AAPL beats expectations")).not.toBeInTheDocument();
        expect(screen.queryByText("AAPL holds steady")).not.toBeInTheDocument();
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
        expect(mockGet).toHaveBeenCalledWith("/news/?category=business");

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