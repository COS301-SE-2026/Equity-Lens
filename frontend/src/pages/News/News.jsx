import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Bookmark, Star, Newspaper, Globe, UserRound } from "lucide-react";
import api from "../../services/api"

const NewsInvestment = () => {
  const [articles, setArticles] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [wishlistLowest, setWishlistLowest] = useState([]);
  const [wishlistHighest, setWishlistHighest] = useState([]);
  const [ticker, setTicker] = useState("");
  const [activeTab, setActiveTab] = useState("portfolio");
  const [activeCategory, setActiveCategory] = useState("portfolio");
  const [portfoliosTickers, setPortfoliosTickers] = useState([]);
  const [positive, setPositive] = useState(0);
  const [negative, setNegative] = useState(0);
  const [neutral, setNeutral] = useState(0);
  const [totalArticles, setTotalArticles] = useState(0);


  const ToGetTickerNews = async (ticker) => {
    const response = await api.get(`/news/test-aapl/${ticker}`);

    const tickerArticles = response.data.articles || [];

    const formattedArticles = tickerArticles.map((article) => ({
      article_id: article.uuid,
      title: article.title,
      description: article.description,
      image_url: article.image_url,
      pubDate: article.published_at,
      source_name: article.source,
      category: [ticker]
    }))

    setArticles(formattedArticles)
    setPositive(response.data.positive || 0);
    setNegative(response.data.negative || 0);
    setNeutral(response.data.neutral || 0);
    setTotalArticles(response.data.total_articles || 0)


  };

  const ToGetPortfoliosTickers = async () => {
    const reponse = await api.get("/news/portfolio-tickers");
    setPortfoliosTickers(reponse.data.tickers || []);
  }

  useEffect(() => {
    ToGetPortfoliosTickers();
  }, []);



  const AddStock = async (ticker) => {
    if (ticker === "") {
      return;
    }

    await api.post("/watchlist/", {
      ticker: ticker,
    }
    )

    setTicker("");
    ToGetWishlist();

  }



  const ToGetTheNews = async (getName = "business") => {
    const gettingTheNews = await api.get(`/news/?category=${getName}`);
    setArticles(gettingTheNews.data.results || []);

    setPositive(gettingTheNews.data.positive || 0);
    setNegative(gettingTheNews.data.negative || 0);
    setNeutral(gettingTheNews.data.neutral || 0);
    setTotalArticles(gettingTheNews.data.total_articles || 0);

  }

  const ToGetWishlist = async () => {
    const wishlist = await api.get(`/watchlist/`);

    setWishlist(wishlist.data.watchlist || []);
    setWishlistHighest(wishlist.data.highest);
    setWishlistLowest(wishlist.data.lowest);

  }

  const ToDeleteWishlist = async (WatchlistID) => {
    await api.delete(`/watchlist/${WatchlistID}`);
    ToGetWishlist();
  }

  useEffect(() => { ToGetTheNews() }, []);

  useEffect(() => { ToGetWishlist() }, []);



  return (

    <div className="mb-8">

      <h1 className="text-4xl font-bold text-[var(--text-primary)]">Investment News</h1>

      <p className="text-[var(--text-secondary)] mt-2">Stay updated with the latest market news and insights</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">

        <div className="flex items-center gap-4 p-4 border border-[var(--border-subtle)] rounded-xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/15">
            <Newspaper className="w-6 h-6 text-blue-500" />
          </div>

          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              Relevant Articles
            </p>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              {totalArticles}
            </p>
            <p className="text-sm text-[var(--text-primary)]">
              Today
            </p>

          </div>
        </div>


        <div className="flex items-center gap-4 p-4 border border-[var(--border-subtle)] rounded-xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/15">
            <TrendingUp className="w-6 h-6 text-green-500" />
          </div>

          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              Positive Impact
            </p>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              {positive}
            </p>
            <p className="text-sm text-[var(--text-primary)]">
              On your holdings
            </p>

          </div>
        </div>


        <div className="flex items-center gap-4 p-4 border border-[var(--border-subtle)] rounded-xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/15">
            <TrendingDown className="w-6 h-6 text-red-500" />
          </div>

          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              Negative Impact
            </p>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              {negative}
            </p>
            <p className="text-sm text-[var(--text-primary)]">
              Today
            </p>

          </div>
        </div>


        <div className="flex items-center gap-4 p-4 border border-[var(--border-subtle)] rounded-xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/15">
            <Star className="w-6 h-6 text-purple-500" />
          </div>

          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              Neutral Impact
            </p>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              {neutral}
            </p>
            <p className="text-sm text-[var(--text-primary)]">
              Today
            </p>

          </div>
        </div>

      </div>

      <div className="flex items-center mt-4 gap-2">
        <button
          onClick={() => setActiveTab("portfolio")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors border text-sm font-medium ${activeTab === "portfolio"
            ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
            : "bg-transparent text-[var(--text-secondary)] border-[var(--border-subtle)]"
            }`}
        >
          <UserRound className="w-4 h-4" />
          My portfolio
        </button>

        <button
          onClick={() => setActiveTab("watchlist")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors border text-sm font-medium ${activeTab === "watchlist"
            ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
            : "bg-transparent text-[var(--text-secondary)] border-[var(--border-subtle)]"
            }`}>
          <Star className="w-4 h-4" />
          Watchlist
        </button>

        <button onClick={() => { setActiveTab("market"); setActiveCategory("Business"); ToGetTheNews("business") }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors border text-sm font-medium ${activeTab === "market"
            ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
            : "bg-transparent text-[var(--text-secondary)] border-[var(--border-subtle)]"
            }`}>
          <UserRound className="w-4 h-4" />
          All Market
        </button>
      </div>

      {activeTab === "portfolio" && (
        <div className="mt-6">

          <div className="grid grid-cols-3 gap-6 mt-6">

            <div className="col-span-3 p-5 border border-[var(--border-subtle)] rounded-2xl">

              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Portfolio News</h2>
              <div className="flex items-center justify-between w-full mb-4">
                <div className="flex flex-wrap gap-2">
                  {portfoliosTickers.map((ticker) => (
                    <button key={ticker} onClick={() => { setActiveCategory(ticker); ToGetTickerNews(ticker); }} className={`px-3 py-1 rounded-full ${activeCategory === ticker ?
                      "bg-blue-500/20 text-blue-400 border-blue-500/40" :
                      "bg-[var(--surface-card)] text-[var(--text-secdonary)] border-transparent"}`}>
                      {ticker}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">

                    <button className="px-4 py-2 rounded-lg border border-blue-500/40 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition"> All </button>
                    <button className="px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/20 text-green-400 hover:bg-green-500/30 transition"> Positive </button>
                    <button className="px-4 py-2 rounded-lg border border-red-500/40 bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"> Negative </button>
                    <button className="px-4 py-2 rounded-lg border border-purple-500/40 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition"> Neutral </button>

                  </div>

                  <select className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[">
                    <option value="latest">Sort by: Latest</option>
                    <option value="latest">Most Positive</option>
                    <option value="latest">Most Negative</option>
                  </select>
                </div>
              </div>

              {articles.map((article) => (
                <div key={article.article_id} className="flex items-center  border-b border-[var(--border-subtle)] p-5 gap-4">

                  <div>
                    <img
                      src={article.image_url}
                      alt="news"
                      className="w-20 h-20 rounded-lg object-cover" />
                  </div>


                  <div className="flex-1">
                    <h3 className="text-[var(--text-primary)]">{article.title}</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{article.description}</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{article.pubDate}</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{article.source_name}</p>
                  </div>

                  {article.category.map((article) => (
                    <p key={article} className="px-3 py-1 text-sm rounded-full" style={{ background: 'var(--signal-positive-bg)', color: 'var(--signal-positive)' }}>
                      {article}
                    </p>
                  ))}


                </div>
              ))}

            </div>
          </div>
        </div>
      )}

      {activeTab === "watchlist" && (
        <div className="mt-6">

          <div className="grid grid-cols-3 gap-6 mt-6">

            <div className="col-span-3 p-5 border border-[var(--border-subtle)] rounded-2xl">

              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Watchlist News</h2>
              <div className="flex items-center justify-between w-full mb-4">
                <div className="flex flex-wrap items-center gap-2 mt-3 mb-6">
                  <button onClick={() => {
                    ToGetTheNews("All");
                    setActiveCategory("All")
                  }} className={`px-3 py-1 rounded-full ${activeCategory == "All" ? "bg-blue-500/20 text-blue border border-blue-500/40 " : "bg-[var(--surface-card)] text-[var(--text-secondary)]"}`}> All </button>
                  <button onClick={() => {
                    ToGetTheNews("Top")
                    setActiveCategory("Top")
                  }} className={`px-3 py-1 rounded-full ${activeCategory == "Top" ? "bg-blue-500/20 text-blue border border-blue-500/40 " : "bg-[var(--surface-card)] text-[var(--text-secondary)]"}`}> Top </button>
                  <button onClick={() => {
                    ToGetTheNews("Business")
                    setActiveCategory("Business")
                  }} className={`px-3 py-1 rounded-full ${activeCategory == "Business" ? "bg-blue-500/20 text-blue border border-blue-500/40 " : "bg-[var(--surface-card)] text-[var(--text-secondary)]"}`}> Business </button>
                  <button onClick={() => {
                    ToGetTheNews("Technology")
                    setActiveCategory("Technology")
                  }} className={`px-3 py-1 rounded-full ${activeCategory == "Technology" ? "bg-blue-500/20 text-blue border border-blue-500/40 " : "bg-[var(--surface-card)] text-[var(--text-secondary)]"}`}> Technology </button>
                  <button onClick={() => {
                    ToGetTheNews("Politics")
                    setActiveCategory("Politics")
                  }} className={`px-3 py-1 rounded-full ${activeCategory == "Politics" ? "bg-blue-500/20 text-blue border border-blue-500/40 " : "bg-[var(--surface-card)] text-[var(--text-secondary)]"}`}> Politics </button>
                  <button onClick={() => {
                    ToGetTheNews("Crime")
                    setActiveCategory("Crime")
                  }} className={`px-3 py-1 rounded-full ${activeCategory == "Crime" ? "bg-blue-500/20 text-blue border border-blue-500/40 " : "bg-[var(--surface-card)] text-[var(--text-secondary)]"}`}> Crime </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">

                    <button className="px-4 py-2 rounded-lg border border-blue-500/40 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition"> All </button>
                    <button className="px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/20 text-green-400 hover:bg-green-500/30 transition"> Positive </button>
                    <button className="px-4 py-2 rounded-lg border border-red-500/40 bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"> Negative </button>
                    <button className="px-4 py-2 rounded-lg border border-purple-500/40 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition"> Neutral </button>

                  </div>

                  <select className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[">
                    <option value="latest">Sort by: Latest</option>
                    <option value="latest">Most Positive</option>
                    <option value="latest">Most Negative</option>
                  </select>
                </div>
              </div>

              {articles.map((article) => (
                <div key={article.article_id} className="flex items-center  border-b border-[var(--border-subtle)] p-5 gap-4">

                  <div>
                    <img
                      src={article.image_url}
                      alt="news"
                      className="w-20 h-20 rounded-lg object-cover" />
                  </div>


                  <div className="flex-1">
                    <h3 className="text-[var(--text-primary)]">{article.title}</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{article.description}</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{article.pubDate}</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{article.source_name}</p>
                  </div>

                  {article.category.map((article) => (
                    <p key={article} className="px-3 py-1 text-sm rounded-full" style={{ background: 'var(--signal-positive-bg)', color: 'var(--signal-positive)' }}>
                      {article}
                    </p>
                  ))}


                </div>
              ))}

            </div>
          </div>
        </div>
      )}


      {activeTab === "market" && (
        <div className="mt-6">

          <div className="grid grid-cols-3 gap-6 mt-6">

            <div className="col-span-3 p-5 border border-[var(--border-subtle)] rounded-2xl">

              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Market News</h2>
              <div className="flex items-center justify-between w-full mb-4">
                <div className="flex flex-wrap items-center gap-2 mt-3 mb-6">
                  <button onClick={() => {
                    ToGetTheNews("All");
                    setActiveCategory("All")
                  }} className={`px-3 py-1 rounded-full ${activeCategory == "All" ? "bg-blue-500/20 text-blue border border-blue-500/40 " : "bg-[var(--surface-card)] text-[var(--text-secondary)]"}`}> All </button>
                  <button onClick={() => {
                    ToGetTheNews("Top")
                    setActiveCategory("Top")
                  }} className={`px-3 py-1 rounded-full ${activeCategory == "Top" ? "bg-blue-500/20 text-blue border border-blue-500/40 " : "bg-[var(--surface-card)] text-[var(--text-secondary)]"}`}> Top </button>
                  <button onClick={() => {
                    ToGetTheNews("Business")
                    setActiveCategory("Business")
                  }} className={`px-3 py-1 rounded-full ${activeCategory == "Business" ? "bg-blue-500/20 text-blue border border-blue-500/40 " : "bg-[var(--surface-card)] text-[var(--text-secondary)]"}`}> Business </button>
                  <button onClick={() => {
                    ToGetTheNews("Technology")
                    setActiveCategory("Technology")
                  }} className={`px-3 py-1 rounded-full ${activeCategory == "Technology" ? "bg-blue-500/20 text-blue border border-blue-500/40 " : "bg-[var(--surface-card)] text-[var(--text-secondary)]"}`}> Technology </button>
                  <button onClick={() => {
                    ToGetTheNews("Politics")
                    setActiveCategory("Politics")
                  }} className={`px-3 py-1 rounded-full ${activeCategory == "Politics" ? "bg-blue-500/20 text-blue border border-blue-500/40 " : "bg-[var(--surface-card)] text-[var(--text-secondary)]"}`}> Politics </button>
                  <button onClick={() => {
                    ToGetTheNews("Crime")
                    setActiveCategory("Crime")
                  }} className={`px-3 py-1 rounded-full ${activeCategory == "Crime" ? "bg-blue-500/20 text-blue border border-blue-500/40 " : "bg-[var(--surface-card)] text-[var(--text-secondary)]"}`}> Crime </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">

                    <button className="px-4 py-2 rounded-lg border border-blue-500/40 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition"> All </button>
                    <button className="px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/20 text-green-400 hover:bg-green-500/30 transition"> Positive </button>
                    <button className="px-4 py-2 rounded-lg border border-red-500/40 bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"> Negative </button>
                    <button className="px-4 py-2 rounded-lg border border-purple-500/40 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition"> Neutral </button>

                  </div>

                  <select className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[">
                    <option value="latest">Sort by: Latest</option>
                    <option value="latest">Most Positive</option>
                    <option value="latest">Most Negative</option>
                  </select>
                </div>
              </div>



              {articles.map((article) => (
                <div key={article.article_id} className="flex items-center  border-b border-[var(--border-subtle)] p-5 gap-4">

                  <div>
                    <img
                      src={article.image_url}
                      alt="news"
                      className="w-20 h-20 rounded-lg object-cover" />
                  </div>


                  <div className="flex-1">
                    <h3 className="text-[var(--text-primary)]">{article.title}</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{article.description}</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{article.pubDate}</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{article.source_name}</p>
                  </div>

                  {article.category.map((article) => (
                    <p key={article} className="px-3 py-1 text-sm rounded-full" style={{ background: 'var(--signal-positive-bg)', color: 'var(--signal-positive)' }}>
                      {article}
                    </p>
                  ))}


                </div>
              ))}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsInvestment;