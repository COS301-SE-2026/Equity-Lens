import { useEffect, useState } from "react";
import { API_BASE_URL_NEWS } from "../../utils/constants";

const NewsInvestment = () => {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL_NEWS}/api/news`)
      .then((thedata) => thedata.json())
      .then((settingdata) => setArticles(settingdata.articles || []))
      .catch((error) => console.log(error));
  }, []);


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

        </div>

        <div className="p-5 border border-gray-700 rounded-2xl">

          <h2 className="text-xl font-semibold text-white mb-2">Top News For My Portfolio</h2>

        </div>

      </div>

    
    </div>






      




    




  );
};

export default NewsInvestment;