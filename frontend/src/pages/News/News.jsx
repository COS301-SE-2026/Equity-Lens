import { useEffect, useState } from "react";

const NewsInvestment = () => {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    fetch("http://localhost:8000/api/news")
      .then((thedata) => thedata.json())
      .then((settingdata) => setArticles(settingdata.articles || []))
      .catch((error) => console.log(error));
  }, []);

  return (
    <div>
      <h1>Investment News</h1>

      {articles.map((article, index) => (
        <div key={index}>
          <h2>{article.title}</h2>
          <p>{article.description}</p>
          <a href={article.url}>
            click in here to go to,or to read more information
          </a>
          <hr />
        </div>
      ))}
    </div>
  );
};

export default NewsInvestment;