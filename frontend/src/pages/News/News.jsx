import { useEffect, useState } from "react";
import { getToken } from "../../services/authService"
import { TrendingUp, TrendingDown, Bookmark } from "lucide-react"

const NewsInvestment = () => {
  const [articles, setArticles] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [wishlistLowest, setWishlistLowest] = useState([]);
  const [wishlistHighest, setWishlistHighest] = useState([]);



  const ToGetTheNews = async (getName = "business") => {
    const gettingTheNews = await fetch(
      `http://localhost:8000/news/?category=${getName}`,
      {
        method: "GET",
      }
    );
  
    const getImportNews = await gettingTheNews.json();
    setArticles(getImportNews.results || []);

  }

   const ToGetWishlist = async (getName = "business") => {
    const wishlist = await fetch(
      `http://localhost:8000/watchlist/`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getToken()}`
        }
      }
    );
  
    const getWishList = await wishlist.json();
    setWishlist(getWishList.watchlist || []);
    setWishlistHighest(getWishList.highest);
    setWishlistLowest(getWishList.lowest);

  }
 
  useEffect(() => {ToGetTheNews()},[]);
  useEffect(() => {ToGetWishlist()},[]);



  return (
    
    <div className="mb-8">

      <h1 className="text-4xl font-bold text-white">Investment News</h1>

      <p className="text-gray-400 mt-2">Stay updated with the latest market news and insights</p>

      <div className="grid grid-cols-4 gap-8 mt-4">

        <div className="p-6 border border-gray-700 rounded-2xl">
              <h2 className="text-xl font-bold text-white mb-2">Market Overview</h2>
              <p>test</p>
              <p>testing</p>
           <div>
          </div>
          
        
        </div>

        <div className="p-6 border border-gray-700 rounded-2xl">
          <div className="flex justify-between">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Top Gainer</h2>
              <p>{wishlistHighest.ticker}({wishlistHighest.sector})</p>
              <p className="text-green-500">+{wishlistHighest.change_percent}</p>
            </div>
           <div>
          <TrendingUp className="w-10 h-10 text-green-500"></TrendingUp>
          </div>
          
        </div>
        
        </div>

        <div className="p-6 border border-gray-700 rounded-2xl">
          <div className="flex justify-between">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Top Loser</h2>
              <p>{wishlistLowest.ticker}({wishlistLowest.sector})</p>
              <p className="text-red-500">{wishlistLowest.change_percent}</p>
            </div>
           <div>
          <TrendingDown className="w-10 h-10 text-red-500"></TrendingDown>
          </div>
          
        </div>
      
        </div>
        
        <div className="p-6 border border-gray-700 rounded-2xl">
          <div className="flex justify-between">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">My Watchlist</h2>
              <p>{wishlist.length}</p>
              <p>Stocks</p>
            </div>
           <div>
          <Bookmark className="w-10 h-10 text-yellow-300"></Bookmark>
          </div>
          
        </div>
        
        </div>

       

        

      </div>


      <div className="grid grid-cols-3 gap-6 mt-6">

        <div className="col-span-2 p-5 border border-gray-700 rounded-2xl">

          <h2 className="text-xl font-semibold text-white mb-2">Latest News</h2>
          <div>
            <button onClick={() => ToGetTheNews("business")}  className="px-3 py-1 rounded-full bg-gray-800 text-gray-300 ml-4"> All </button>
            <button onClick={() => ToGetTheNews("Top")} className="px-3 py-1 rounded-full bg-gray-800 text-gray-300 ml-4"> Top </button>
            <button onClick={() => ToGetTheNews("Business")} className="px-3 py-1 rounded-full bg-gray-800 text-gray-300 ml-4"> Business </button>
            <button onClick={() => ToGetTheNews("Technology")} className="px-3 py-1 rounded-full bg-gray-800 text-gray-300 ml-4"> Technology </button>
            <button onClick={() => ToGetTheNews("Politics")} className="px-3 py-1 rounded-full bg-gray-800 text-gray-300 ml-4"> Politics </button>
            <button onClick={() => ToGetTheNews("Crime")} className="px-3 py-1 rounded-full bg-gray-800 text-gray-300 ml-4"> Crime </button>
          </div>

          {articles.map((article) => (
          <div key={article.article_id} className="flex items-center  border-b border-gray-700 p-5 gap-4">

            <div>
              <img
                src={article.image_url}
                alt="news"
                className="w-20 h-20 rounded-lg object-cover"/>
            </div>


            <div className="flex-1">
              <h3 className="text-white">{article.title}</h3>
              <p className="text-sm text-gray-400 mt-1">{article.description}</p>
              <p className="text-sm text-gray-400 mt-1">{article.pubDate}</p>
              <p className="text-sm text-gray-500 mt-1">{article.source_name}</p>
            </div>

            {article.category.map((article) => (
              <p key={article} className="px-3 py-1 text-sm rounded-full bg-green-900 text-green-400">
                {article}
              </p>
            ))}


          </div>
        ))}

        </div>

      <div className="flex flex-col gap-6">

     <div className="p-5 border border-gray-700 rounded-2xl">

      <div className="flex justify-between mb-4">
        <h2 className="text-white text-3xl">
          My Watchlist
        </h2>
        <button  className="p-4 py-2 bg-green-700 text-white item-center rounded-full">
          + Add Stock
        </button>
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
              {wishlist.map((items) => (         
            <tr key={items} className="border-b border-gray-400 mb-7">
            <td>
              <p className="text-white-400">{items.ticker}</p>
              <p className="text-gray-400">{items.company_name}</p>
            </td>
            <td className="text-white-400">
              {items.current_price}
            </td>
            <td className="text-green-400">
              {items.change_percent}
            </td>
            <td className="text-center">
             <button className="text-red-400 hover:text-red-300">Remove</button>
            </td>
          </tr>
          ))}


          </tbody>
          
       </table>
        </div>

      
       {/* <div className="p-5 border border-gray-700 rounded-2xl">
        To Do Later
       </div> */}
       

      </div> 
       </div>

    </div>


  );
};

export default NewsInvestment;