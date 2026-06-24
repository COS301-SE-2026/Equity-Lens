import { useEffect, useState } from "react";

const NewsInvestment = () => {
  const [articles, setArticles] = useState([]);

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

  console.log("test",articles);

  useEffect(() => {ToGetTheNews()},[]);


  return (
    
    <div className="mb-8">

      <h1 className="text-4xl font-bold text-white">Investment News</h1>

      <p className="text-gray-400 mt-2">Stay updated with the latest market news and insights</p>

      <div className="grid grid-cols-3 gap-8 mt-4">

        <div className="p-6 border border-grey-700 rounded-2xl">
          <h2 className="text-xl font-semibold text-white mb-2">Market Overview</h2>
          <p> To Do, to put a date</p>
        </div>

        <div className="p-6 border border-grey-700 rounded-2xl">
          <h2 className="text-xl font-semibold text-white mb-2">Market Overview</h2>
        </div>

        <div className="p-6 border border-grey-700 rounded-2xl">
          <h2 className="text-xl font-semibold text-white mb-2">My Watchlist</h2>
        </div>

      </div>


      <div className="grid grid-cols-3 gap-6 mt-6">

        <div className="col-span-2 p-5 border border-gray-700 rounded-2xl">

          <h2 className="text-xl font-semibold text-white mb-2">Latest News</h2>

          {articles.map((article) => (
          <div key={article.article_id} className="flex items-center   border-b border-gray-700 p-5 gap-4">

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

        <div className="p-5 border border-gray-700 rounded-2xl">

          <h2 className="text-xl font-semibold text-white mb-2">Top News For My Portfolio</h2>

        </div>

      </div>


         


    </div>

           























  );
};

export default NewsInvestment;