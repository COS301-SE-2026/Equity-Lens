import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Bookmark, Star, Newspaper, Globe, UserRound } from "lucide-react"
import api from "../../services/api"


const NewsInvestment = () => {
  const [articles, setArticles] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [wishlistLowest, setWishlistLowest] = useState([]);
  const [wishlistHighest, setWishlistHighest] = useState([]);
  const [ticker, setTicker] = useState("");
  const [activeTab, setActiveTab] = useState("portfolio")



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
            <p className="text-sm font-bold text-[vat(--text-primary)]">
              Relevant Articles
            </p>
            <p className="text-xl font-bold text-[vat(--text-primary)]">
              12
            </p>
            <p className="text-sm text-[vat(--text-primary)]">
              Today
            </p>

          </div>
        </div>


        <div className="flex items-center gap-4 p-4 border border-[var(--border-subtle)] rounded-xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/15">
            <TrendingUp className="w-6 h-6 text-green-500" />
          </div>

          <div>
            <p className="text-sm font-bold text-[vat(--text-primary)]">
              Positive Impact
            </p>
            <p className="text-xl font-bold text-[vat(--text-primary)]">
              12
            </p>
            <p className="text-sm text-[vat(--text-primary)]">
              On your holdings
            </p>

          </div>
        </div>


        <div className="flex items-center gap-4 p-4 border border-[var(--border-subtle)] rounded-xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/15">
            <TrendingDown className="w-6 h-6 text-red-500" />
          </div>

          <div>
            <p className="text-sm font-bold text-[vat(--text-primary)]">
              Negative Impact
            </p>
            <p className="text-xl font-bold text-[vat(--text-primary)]">
              12
            </p>
            <p className="text-sm text-[vat(--text-primary)]">
              Today
            </p>

          </div>
        </div>


        <div className="flex items-center gap-4 p-4 border border-[var(--border-subtle)] rounded-xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/15">
            <Star className="w-6 h-6 text-purple-500" />
          </div>

          <div>
            <p className="text-sm font-bold text-[vat(--text-primary)]">
              Holdings Mentioned
            </p>
            <p className="text-xl font-bold text-[vat(--text-primary)]">
              12
            </p>
            <p className="text-sm text-[vat(--text-primary)]">
              Companies
            </p>

          </div>
        </div>

      </div>


      <div className="flex items-center mt-4 gap-2">
        <button
          onClick={() => setActiveTab("portfolio")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors border text-sm font-medium ${activeTab == "portfolio"
              ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
              : "bg-transparent text-[var(--text-secondary)] border-[var(--border-subtle)]"
            }`}
        >
          <UserRound className="w-4 h-4" />
          My portfolio
        </button>

        <button
          onClick={() => setActiveTab("watchlist")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors border text-sm font-medium ${activeTab == "watchlist"
              ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
              : "bg-transparent text-[var(--text-secondary)] border-[var(--border-subtle)]"
            }`}>
          <Star className="w-4 h-4" />
          Watchlist
        </button>

        <button onClick={() => setActiveTab("market")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors border text-sm font-medium ${activeTab == "market"
              ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
              : "bg-transparent text-[var(--text-secondary)] border-[var(--border-subtle)]"
            }`}>
          <UserRound className="w-4 h-4" />
          All Market
        </button>
      </div>


      <div className="grid grid-cols-3 gap-6 mt-6">

        <div className="col-span-2 p-5 border border-[var(--border-subtle)] rounded-2xl">

          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Latest News</h2>
          <div>
            <button onClick={() => ToGetTheNews("business")} className="px-3 py-1 rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)] ml-4"> All </button>
            <button onClick={() => ToGetTheNews("Top")} className="px-3 py-1 rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)] ml-4"> Top </button>
            <button onClick={() => ToGetTheNews("Business")} className="px-3 py-1 rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)] ml-4"> Business </button>
            <button onClick={() => ToGetTheNews("Technology")} className="px-3 py-1 rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)] ml-4"> Technology </button>
            <button onClick={() => ToGetTheNews("Politics")} className="px-3 py-1 rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)] ml-4"> Politics </button>
            <button onClick={() => ToGetTheNews("Crime")} className="px-3 py-1 rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)] ml-4"> Crime </button>
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

        <div className="flex flex-col gap-6">

          <div className="p-5 border border-[var(--border-subtle)] rounded-2xl">

            <div className="flex justify-between mb-4">
              <h2 className="text-[var(--text-primary)] text-3xl">
                My Watchlist
              </h2>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Ticker"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="p-2 rounded bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-subtle)]" />
                <button onClick={() => AddStock(ticker)} className="px-4 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)] rounded-lg">
                  Add
                </button>
              </div>
            </div>
            <table className="w-full">

              <thead>
                <tr>
                  <th className="text-left py-3">Ticker</th>
                  <th className="text-left  py-3">Price</th>
                  <th className="text-left  py-3">Change</th>
                  <th className="text-center py-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {wishlist.length === 0 ? (<tr><td className="text-[var(--text-secondary)]">No watchlist stocks added </td></tr>) :
                  (
                    wishlist.map((items) => (
                      <tr key={items.id} className="border-b border-[var(--border-subtle)] mb-7">

                        <td>
                          <p className="text-[var(--text-primary)]">{items.ticker}</p>
                          <p className="text-[var(--text-secondary)]">{items.company_name}</p>
                        </td>
                        <td className="text-[var(--text-primary)]">
                          {items.current_price}
                        </td>
                        <td className="text-[var(--signal-positive)]">
                          {items.change_percent}
                        </td>
                        <td className="text-center">
                          <button onClick={() => ToDeleteWishlist(items.id)} className="text-[var(--signal-negative)] hover:opacity-80">Remove</button>
                        </td>
                      </tr>
                    ))
                  )}
              </tbody>

            </table>
          </div>

        </div>
      </div>
    </div>


  );
};

export default NewsInvestment;