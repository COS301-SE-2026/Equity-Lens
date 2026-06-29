import { useEffect, useState } from "react";
import { getToken } from "../../services/authService"
import { TrendingUp, TrendingDown } from "lucide-react"

const NewsInvestment = () => {
  const [articles, setArticles] = useState([]);
  const [articlesPortfolios, setarticlesPortfolios] = useState([]);
  const [MarketSnapshot, setMarketSnapshot] = useState([]);

  const ToGetTheNews = async (getName) => {
    const gettingTheNews = await fetch(
      `http://localhost:8000/news/`,
      {
        method: "GET",
      }
    );
  
    const getImportNews = await gettingTheNews.json();
    setArticles(getImportNews.results);
  }

   const ToGetTheNewsPortfolio = async (getName) => {
    const gettingTheNews = await fetch(
      `http://localhost:8000/news/portfolio_news/`,
      {
        method: "GET",
        headers:
        {
          Authorization: `Bearer ${getToken()}`
        },
      }
    );

    const getImportNews = await gettingTheNews.json();
    setarticlesPortfolios(getImportNews.results);

   }

  const ToGetTheMarketSnapshot = async (getName) => {
    const gettingTheNews = await fetch(
      `http://localhost:8000/news/market_snapshot/`,
      {
        method: "GET",
        headers:
        {
          Authorization: `Bearer ${getToken()}`
        },
      }
    );
  
    const getImportNews = await gettingTheNews.json();
    setMarketSnapshot(getImportNews.data);

    console.log("test",getImportNews)
  }

  console.log("test",articles);

  useEffect(() => {ToGetTheNews()},[]);
  useEffect(() => {ToGetTheNewsPortfolio()},[]);
  useEffect(() => {ToGetTheMarketSnapshot()},[]);


  return (
    
    <div className="mb-8">

      <h1 className="text-4xl font-bold text-white">Investment News</h1>

      <p className="text-gray-400 mt-2">Stay updated with the latest market news and insights</p>

      <div className="grid grid-cols-3 gap-8 mt-4">

        <div className="p-6 border border-gray-700 rounded-2xl">
          <h2 className="text-xl font-semibold text-white mb-2">Market Overview</h2>
          <p> To Do, to put a date</p>
        </div>

        <div className="p-6 border border-gray-700 rounded-2xl">
          <h2 className="text-xl font-semibold text-white mb-2">Market Overview</h2>
        </div>

        <div className="p-6 border border-gray-700 rounded-2xl">
          <h2 className="text-xl font-semibold text-white mb-2">My Watchlist</h2>
        </div>

      </div>


      <div className="grid grid-cols-3 gap-6 mt-6">

        <div className="col-span-2 p-5 border border-gray-700 rounded-2xl">

          <h2 className="text-xl font-semibold text-white mb-2">Latest News</h2>

          {articles.map((article) => (
          <div key={article.article_id} className="flex items-center  border-b border-gray-700 p-5 gap-4">

            <div>
              <img
                src={article.image_url}
                alt="news"
                className="w-20 h-20 rounded-lg object-cover"/>
            </div>


            <div className="flex-1">
              <h3 className="text-white font-medium">{article.title}</h3>
              <p className="text-sm text-gray-400 mt-1">{article.description}</p>
              <p className="text-sm text-gray-400 mt-1">{article.pubDate}</p>
              <p className="text-sm text-gray-500 mt-1">{article.source_name}</p>
            </div>

            <p className="px-3 py-1 text-sm rounded-full bg-green-900 text-green-400">
              {article.category[0]}
            </p>

             <p className="px-3 py-1 text-sm rounded-full bg-black text-green-400">
              {article.country[0]}
            </p>

          </div>
          ))}

        </div>

      <div className="flex flex-col gap-6">

     
        <div className="p-5 border border-gray-700 rounded-2xl">

          <h2 className="text-xl font-semibold text-white mb-4">Top News For My Portfolio</h2>

      
      <div className="flex gap-4 mt-1">

      {articlesPortfolios.slice(0, 3).map((article) => (
        <div key={article.article_id}>

        <div>
          <p className="text-sm text-white font-medium">
            {article.title}
          </p>

          <div >
          <span className="text-xs text-green-400 font-medium">
            {article.source_name}
          </span>

          <span className="text-xs ml-2 text-gray-500">
            - {article.pubDate}
          </span>
          </div>

        </div>
        </div>
     
      ))}

       </div>
        


       </div>


       <div className="p-5 border border-gray-700 rounded-2xl">
        Market Snapshot
      

       <div className="flex flex-col">

        {MarketSnapshot.map((stock) => (


        <div key={stock.symbol} className="flex justify-between mb-4">
          <div className="flex items-center gap-8">
          <p className="text-lg font-semibold text-white"> {stock.symbol}</p>

           <div className="flex items-center gap-1 ">
            {stock.close >= stock.open ? (<TrendingUp className="w-4 h-4 text-green-500"></TrendingUp>) : (<TrendingDown className="w-4 h-4 text-red-500"></TrendingDown>)}

          
          <p className={stock.close >= stock.open ?  ("text-lg font-bold text-green-500") : ("text-lg font-bold text-red-500")}> {(((stock.close - stock.open)/stock.open) * 100).toFixed(2)}%</p>
          </div>
        </div>
          

        <button className="px-3 py-3 text-sm text-white border border-gray-600 rounded-lg">
          + Watchlist
        </button>
       
         </div>
         

           ))}
          
        </div>

       </div>



      </div> 
       </div>

    </div>


  );
};

export default NewsInvestment;