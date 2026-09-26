import {
  TrendingUp,
  TrendingDown,
  Star,
  Newspaper,
  UserRound,
  Globe2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import api from '../../services/api';

const NewsInvestment = () => {
  const [articles, setArticles] = useState(/** @type {any[]}*/([]));
  const [ticker, setTicker] = useState('');
  const [activeTab, setActiveTab] = useState('portfolio');
  const [activeCategory, setActiveCategory] = useState('all');
  const [portfoliosTickers, setPortfoliosTickers] = useState(/** @type {any[]}*/([]));
  const [positive, setPositive] = useState(0);
  const [negative, setNegative] = useState(0);
  const [neutral, setNeutral] = useState(0);
  const [totalArticles, setTotalArticles] = useState(0);
  const [sentimentFilter, setSentimentFilter] = useState('all');

  const ToGetAllPortfolioNews = async () => {
    /** @type{any[]}*/
    let AllArticles = [];

    const validTickers = portfoliosTickers.filter(
      (ticker) => ticker !== 'All',
    );

    for (const ticker of validTickers) {
      const response = await api.get(`/news/ticker/${ticker}`);

      /** @type {Array<any>} */
      const tickerArticles = response.data.articles || [];

      const formattedArticles = tickerArticles.map((article) => ({
        ...article,
        category: [ticker],
      }))
      AllArticles = [...AllArticles, ...formattedArticles];
    }

    setArticles(AllArticles);
    const positiveCount = AllArticles.filter(
      (article) => article.sentiment === 'positive',
    ).length;

    const negativeCount = AllArticles.filter(
      (article) => article.sentiment === 'negative',
    ).length;

    const neutralCount = AllArticles.filter(
      (article) => article.sentiment === 'neutral',
    ).length;

    setPositive(positiveCount);
    setNegative(negativeCount);
    setNeutral(neutralCount);
    setTotalArticles(AllArticles.length);
    setActiveCategory('all');
    setSentimentFilter('all');
  };


  /** @param {string} ticker*/
  const ToGetTickerNews = async (ticker) => {
    const response = await api.get(`/news/ticker/${ticker}`);

    /** @type {Array<any>} */
    const tickerArticles = response.data.articles || [];

    const formattedArticles = tickerArticles.map((article) => ({
      ...article,
      category: [ticker],
    }));

    setArticles(formattedArticles);
    setPositive(response.data.positive || 0);
    setNegative(response.data.negative || 0);
    setNeutral(response.data.neutral || 0);
    setTotalArticles(response.data.total_articles || 0);
    setActiveCategory(ticker);
    setSentimentFilter('all');
  };

  const ToGetPortfoliosTickers = async () => {
    const reponse = await api.get('/news/portfolio-tickers');
    setPortfoliosTickers(reponse.data.tickers || []);
  };


  useEffect(() => {
    const loadPortfolio = async () => {
      const response = await api.get('/news/portfolio-tickers');
      const tickers = response.data.tickers || [];

      setPortfoliosTickers(tickers.filter((ticker) => ticker !== 'All'),);

      const validTickers = tickers.filter(
        (ticker) => ticker !== 'All',
      );

      let allArticles = [];

      for (const ticker of validTickers) {
        try {
          const newsResponse = await api.get(
            `/news/ticker/${ticker}`,
          );

          const tickerArticles =
            newsResponse.data.articles || [];

          const formattedArticles = tickerArticles.map((article) => ({
            ...article,
            category: [ticker],
          }));

          allArticles = [...allArticles, ...formattedArticles];
        } catch (error) {
          console.error(`Failed to get news for ${ticker}:`, error);
        }
      }

      setArticles(allArticles);

      const positiveCount = allArticles.filter(
        (article) => article.sentiment === 'positive',
      ).length;

      const negativeCount = allArticles.filter(
        (article) => article.sentiment === 'negative',
      ).length;

      const neutralCount = allArticles.filter(
        (article) => article.sentiment === 'neutral',
      ).length;

      setPositive(positiveCount);
      setNegative(negativeCount);
      setNeutral(neutralCount);
      setTotalArticles(allArticles.length);

      setActiveCategory('all');
      setSentimentFilter('all');
    };

    loadPortfolio();
  }, []);

  /** @param {string} ticker*/
  const AddStock = async (ticker) => {
    if (ticker === '') {
      return;
    }

    await api.post('/watchlist/', {
      ticker,
    });

    setTicker('');
  };

  const ToGetTheNews = async (getName = 'business') => {
    const gettingTheNews = await api.get(`/news/?category=${getName}`);
    setArticles(gettingTheNews.data.results || []);

    setPositive(gettingTheNews.data.positive || 0);
    setNegative(gettingTheNews.data.negative || 0);
    setNeutral(gettingTheNews.data.neutral || 0);
    setTotalArticles(gettingTheNews.data.total_articles || 0);
  };

  const filteredArticles = articles.filter((article) => {
    if (activeCategory !== 'all' && !(article.category || []).includes(activeCategory)) {
      return false;
    }

    if (sentimentFilter === 'all') {
      return true;
    }

    return article.sentiment === sentimentFilter;
  });

  const marketCategories = ['Business', 'Top', 'Technology', 'Politics', 'Crime'];

  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold text-[var(--text-primary)]">Investment News</h1>

      <p className="text-[var(--text-secondary)] mt-2">
        Stay updated with the latest market news and insights
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">


        <div className="flex items-center rounded-xl border border-blue-500/25 px-2 py-4">


          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/15 bg-blue-500/10">
              <Newspaper className="h-5 w-5 text-blue-400" />
            </div>

            <div>

              <div>
                <p className='text-sm font-semibold text-[var(--text-primary)]'>
                  Relevant Articles
                </p>


                <div className='mt-0.5 flex items-baseline gap-2'>

                  <span className='text-2xl font-bold leading-none text-[var(--text-primary)]'>
                    {totalArticles}
                  </span>


                  <span className='text-xs text-[var(--text-secondary)]'>
                    Today
                  </span>


                </div>
              </div>
            </div>
          </div>

        </div>


        <div className="flex items-center gap-4 p-4 border border-green-500/25 rounded-xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/15">
            <TrendingUp className="w-6 h-6 text-green-500" />
          </div>

          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Positive Impact</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{positive}</p>
            <p className="text-sm text-[var(--text-primary)]">On your holdings</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 border border-red-500/25 rounded-xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/15">
            <TrendingDown className="w-6 h-6 text-red-500" />
          </div>

          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Negative Impact</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{negative}</p>
            <p className="text-sm text-[var(--text-primary)]">Today</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 border border-purple-500/25 rounded-xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/15">
            <Star className="w-6 h-6 text-purple-500" />
          </div>

          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Neutral Impact</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{neutral}</p>
            <p className="text-sm text-[var(--text-primary)]">Today</p>
          </div>
        </div>
      </div>


      <div className="inline-flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1 mt-7">
        <button
          onClick={() => { setActiveTab('portfolio'); ToGetAllPortfolioNews(); }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${activeTab === 'portfolio'
            ? 'bg-blue-500 text-white shadow-sm'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
        >
          <UserRound className="h-4 w-4" />
          My portfolio
        </button>

        <button
          onClick={() => {
            setActiveTab('market');
            setActiveCategory('Business');
            ToGetTheNews('business');
          }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${activeTab === 'market'
            ? 'bg-blue-500 text-white shadow-sm'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
        >
          <Globe2 className="h-4 w-4" />
          All Market
        </button>
      </div>

      {activeTab === 'portfolio' && (
        <div className="mt-6">
          <div className="grid grid-cols-3 gap-6 mt-6">
            <div className="col-span-3 p-5 border border-[var(--border-subtle)] rounded-2xl">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                Portfolio News
              </h2>
              <p className='mt-1 mb-4 text-sm text-[var(--text-secondary)]'>
                News and market updates related to your current holdings
              </p>
              <div className="flex items-center justify-between w-full mb-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setActiveCategory('all'); ToGetAllPortfolioNews(); }}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${activeCategory === 'all'
                      ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-blue-500/40 hover:text-[var(--text-primary)]'
                      }`}
                  >
                    All
                  </button>
                  {portfoliosTickers.map((ticker) => (
                    <button
                      key={ticker}
                      onClick={() => {
                        setActiveCategory(ticker);
                        ToGetTickerNews(ticker);
                      }}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${activeCategory === ticker
                        ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-blue-500/40 hover:text-[var(--text-primary)]'
                        }`}
                    >
                      {ticker}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSentimentFilter('positive')}
                      className="px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/20 text-green-400 hover:bg-green-500/30 transition"
                    >
                      {' '}
                      Positive{' '}
                    </button>
                    <button
                      onClick={() => setSentimentFilter('negative')}
                      className="px-4 py-2 rounded-lg border border-red-500/40 bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                    >
                      {' '}
                      Negative{' '}
                    </button>
                    <button
                      onClick={() => setSentimentFilter('neutral')}
                      className="px-4 py-2 rounded-lg border border-purple-500/40 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition"
                    >
                      {' '}
                      Neutral{' '}
                    </button>
                  </div>
                </div>
              </div>

              {filteredArticles.length === 0 ? (
                <div className="py-12 text-center text-[var(--text-secondary)]">
                  <p className="text-lg font-medium">No news available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredArticles.map((article) => {
                    const articleLink = article.url || article.link;

                    return (
                      <div
                        key={article.article_id}
                        className="flex items-center gap-5 rounded-xl border border-gray-700 bg-gray-900/40 p-4 transition hover:border-gray-600 hover:bg-gray-900/70"
                      >
                        <div className="shrink-0">
                          <img
                            src={article.image_url}
                            alt={article.title}
                            className="h-24 w-28 rounded-lg"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-[var(--text-primary)]">
                            {article.title}
                          </h3>

                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {article.description}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                            <span>{article.source_name}</span>

                            {article.pubDate && (
                              <>
                                <span> - </span>

                                <span>
                                  {new Date(article.pubDate).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {article.category?.map(
              /** @param {string} category */(category) => (
                              <span
                                key={category}
                                className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-400"
                              >
                                {category}
                              </span>
                            ),
                          )}

                          <span
                            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium capitalize ${article.sentiment === 'positive'
                              ? 'bg-green-500/20 text-green-400'
                              : article.sentiment === 'negative'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-purple-500/20 text-purple-400'
                              }`}
                          >
                            {article.sentiment === 'positive' && (
                              <TrendingUp className="h-3.5 w-3.5" />
                            )}

                            {article.sentiment === 'negative' && (
                              <TrendingDown className="h-3.5 w-3.5" />
                            )}

                            {article.sentiment === 'neutral' && <span>−</span>}

                            {article.sentiment}
                          </span>

                          {articleLink && (
                            <a
                              href={articleLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-400 transition-all duration-200 hover:border-blue-500 hover:bg-blue-500 hover:text-white"
                            >
                              Read article
                              <span className="text-xs">↗</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'market' && (
        <div className="mt-6">
          <div className='rounded-2xl border border-[var(--border-subtle)] p-5'>
            <div>
              <h2 className='text-xl font-semibold text-[var(--text-primary)]'>
                Market News
              </h2>

              <p className='mt-1 text-sm text-[var(--text-secondary)]'>
                Latest financial and market stories
              </p>

            </div>


            <div className='mt-3 flex flex-wrap items-center gap-2'>
              {marketCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    setActiveCategory(category);
                    ToGetTheNews(category.toLowerCase());
                  }}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${activeCategory === category
                    ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-blue-500/40 hover:text-[var(--text-primary)]'
                    }`}
                >
                  {category}
                </button>
              ))}
            </div>


            {articles.length === 0 ? (
              <div className="py-12 text-center text-[var(--text-secondary)]">
                <p className="text-lg font-medium">No news available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {articles.map((article) => {
                  const articleLink = article.url || article.link;

                  return (
                    <div
                      key={article.article_id}
                      className="flex items-center gap-5 rounded-xl border border-gray-700 bg-gray-900/40 p-4 transition hover:border-gray-600 hover:bg-gray-900/70"
                    >
                      <div className="shrink-0">
                        <img
                          src={article.image_url}
                          alt={article.title}
                          className="h-24 w-28 rounded-lg object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-[var(--text-primary)]">
                          {article.title}
                        </h3>

                        <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                          {article.description}
                        </p>

                        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                          <span>{article.source_name}</span>

                          {article.pubDate && (
                            <>
                              <span> - </span>
                              <span>
                                {new Date(article.pubDate).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {article.category?.map(
              /** @param {string} category */(category) => (
                            <span
                              key={category}
                              className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-400"
                            >
                              {category}
                            </span>
                          ),
                        )}

                        {articleLink && (
                          <a
                            href={articleLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400 transition hover:bg-blue-500/20 hover:text-blue-300"
                          >
                            Read article
                            <span>↗</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}


          </div>
        </div>
      )}
    </div>
  );
};

export default NewsInvestment;
