import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Bookmark } from "lucide-react"
import api from "../../services/api"


const NewsInvestment = () => {
  const [articles, setArticles] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [wishlistLowest, setWishlistLowest] = useState([]);
  const [wishlistHighest, setWishlistHighest] = useState([]);
  const [ticker, setTicker] = useState("");



  const AddStock = async (ticker) => {
  if(ticker === "")
  {
    return;
  }

  await api.post("/watchlist/",{
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
 
  useEffect(() => {ToGetTheNews()},[]);
  useEffect(() => {ToGetWishlist()},[]);



  return (
    
    <div className="mb-8">

      <h1 className="text-4xl font-bold text-[var(--text-primary)]">Investment News</h1>

      <p className="text-[var(--text-secondary)] mt-2">Stay updated with the latest market news and insights</p>

      <div className="grid grid-cols-3 gap-8 mt-4">

        <div className="p-6 border border-[var(--border-subtle)] rounded-2xl">
          <div className="flex justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Top Gainer</h2>
              {wishlist.length === 0 ? (<p className="text-[var(--text-secondary)]"> No Watchlist added</p>) : wishlistHighest.change_percent > 0 ? (<> <p>{wishlistHighest.ticker}({wishlistHighest.sector})</p> <p className="text-[var(--signal-positive)]">+{wishlistHighest.change_percent}</p> </>) : (<p>No Top Gainer</p>)}
            </div>
           <div>
          <TrendingUp className="w-10 h-10 text-[var(--signal-positive)]"></TrendingUp>
          </div>
          
        </div>
        
        </div>

        <div className="p-6 border border-[var(--border-subtle)] rounded-2xl">
          <div className="flex justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Top Loser</h2>
              {wishlist.length == 0 ? (<p className="text-[var(--text-secondary)]">No Watchlist added</p>) : wishlistLowest.change_percent < 0 ? (<> <p>{wishlistLowest.ticker} {wishlistLowest.sector})</p> <p className="text-[var(--signal-negative)]">{wishlistLowest.change_percent}</p> </>) : (<p>No Top Loser</p>)}
            </div>
           <div>
          <TrendingDown className="w-10 h-10 text-[var(--signal-negative)]"></TrendingDown>
          </div>
          
        </div>
      
        </div>
        
        <div className="p-6 border border-[var(--border-subtle)] rounded-2xl">
          <div className="flex justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">My Watchlist</h2>
              <p>{wishlist.length}</p>
              <p>Stocks</p>
            </div>
           <div>
          <Bookmark className="w-10 h-10 text-[var(--accent-primary)]"></Bookmark>
          </div>
          
        </div>
        
        </div>
        

      </div>


      <div className="grid grid-cols-3 gap-6 mt-6">

        <div className="col-span-2 p-5 border border-[var(--border-subtle)] rounded-2xl">

          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Latest News</h2>
          <div>
            <button onClick={() => ToGetTheNews("business")}  className="px-3 py-1 rounded-full bg-[var(--surface-card)] text-[var(--text-secondary)] ml-4"> All </button>
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
                className="w-20 h-20 rounded-lg object-cover"/>
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
          className="p-2 rounded bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-subtle)]"/>
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
            <tr key={items} className="border-b border-[var(--border-subtle)] mb-7">
              wishlist.map(
                /**
                 * @param {any} items
                 */
                (items) => (         
            <tr key={items.id} className="border-b border-gray-400 mb-7">

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
          )) )}


          </tbody>
          
       </table>
        </div>

      
       <div className="p-5 border border-[var(--border-subtle)] rounded-2xl">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">AI Suggestions</h2>
        <div>
          <button className="w-full p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] mb-4">Why is my top gainer up ?</button>
          <button className="w-full p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] mb-4">Why is my top loser down ?</button>
          <button className="w-full p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] mb-4">Which watchlist stock is the best ?</button>
          <button className="w-full p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] mb-4">Summarise today`&apos;`s news</button>
        </div>
       </div>
       

      </div> 
       </div>

    </div>


  );
};

export default NewsInvestment;