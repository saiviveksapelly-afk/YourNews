import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import ToastMessage from '../components/ToastMessage.tsx';
import NewsImage from '../components/NewsImage.tsx';
import { clearAuthToken, getAuthToken } from '../auth/authToken.ts';
import { NEWS_CATEGORIES } from '../config/newsCategories.ts';
import { NEWS_REGIONS } from '../config/newsRegions.ts';
import type { NewsArticle } from '../types/newsArticle.ts';
import './CatalogPage.css';

function formatPublishedAt(value: string) {
  const publishedAt = new Date(value);
  if (Number.isNaN(publishedAt.getTime())) return 'Publication time unavailable';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(publishedAt);
}

function CatalogPage() {
  const [articleView, setArticleView] = useState<'latest' | 'top10'>('top10');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  // The national feeds currently supply stories in all four genres.
  const [selectedRegion, setSelectedRegion] = useState<(typeof NEWS_REGIONS)[number]>('National');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [slideIndex, setSlideIndex] = useState(0);
  const [isDarkTheme, setIsDarkTheme] = useState(
    () => localStorage.getItem('catalog-theme') === 'dark',
  );
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [topStories, setTopStories] = useState<NewsArticle[]>([]);
  const [featuredArticle, setFeaturedArticle] = useState<NewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryNumber, setRetryNumber] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const notice = (location.state as { notice?: string } | null)?.notice;

  const dismissNotice = useCallback(() => {
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, navigate]);

  useEffect(() => {
    let requestIsCurrent = true;

    async function loadArticles() {
      setIsLoading(true);
      setErrorMessage('');

      const token = getAuthToken();
      if (!token) {
        navigate('/login', {
          replace: true,
          state: { notice: 'Please sign in to view the news catalog.' },
        });
        return;
      }

      const query = new URLSearchParams({ region: selectedRegion, view: articleView });
      if (selectedCategory !== 'All') query.set('category', selectedCategory);
      if (fromDate) query.set('from', fromDate);
      if (toDate) query.set('to', toDate);

      try {
        const response = await fetch(`/api/articles?${query.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!requestIsCurrent) return;

        if (response.status === 401) {
          clearAuthToken();
          navigate('/login', {
            replace: true,
            state: { notice: 'Your sign-in has expired. Please sign in again.' },
          });
          return;
        }
        if (!response.ok) {
          setErrorMessage("We couldn't load the news for those filters. Please try again.");
          return;
        }

        const data = (await response.json()) as {
          articles?: NewsArticle[];
          featuredArticle?: NewsArticle | null;
          topStories?: NewsArticle[];
        };
        if (!Array.isArray(data.articles)) {
          setErrorMessage("We couldn't read the news response. Please try again.");
          return;
        }
        setArticles(data.articles);
        setFeaturedArticle(data.featuredArticle ?? null);
        const nextTopStories = Array.isArray(data.topStories) ? data.topStories : [];
        setTopStories((currentTopStories) => {
          const currentIds = currentTopStories.map((story) => story._id).join(',');
          const nextIds = nextTopStories.map((story) => story._id).join(',');
          return currentIds === nextIds ? currentTopStories : nextTopStories;
        });
      } catch {
        if (requestIsCurrent) {
          setErrorMessage("We couldn't connect to the news service. Check your connection and try again.");
        }
      } finally {
        if (requestIsCurrent) setIsLoading(false);
      }
    }

    void loadArticles();
    const pollingTimer = window.setInterval(() => void loadArticles(), 60_000);
    return () => {
      requestIsCurrent = false;
      window.clearInterval(pollingTimer);
    };
  }, [articleView, selectedCategory, selectedRegion, fromDate, toDate, retryNumber, navigate]);

  useEffect(() => {
    localStorage.setItem('catalog-theme', isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme]);

  const bannerArticles = topStories;
  // The list can change while polling. Keep the selected slide in range
  // without setting React state from an effect.
  const activeSlideIndex = bannerArticles.length > 0 ? slideIndex % bannerArticles.length : 0;
  const currentBannerArticle = bannerArticles[activeSlideIndex] ?? featuredArticle;

  function handleSignOut() {
    clearAuthToken();
    navigate('/login', { replace: true, state: { notice: 'You have signed out.' } });
  }

  function moveBanner(direction: -1 | 1) {
    if (bannerArticles.length < 2) return;
    setSlideIndex((activeSlideIndex + direction + bannerArticles.length) % bannerArticles.length);
  }

  return (
    <main className={`catalog-page ${isDarkTheme ? 'theme-dark' : 'theme-light'}`}>
      <header className="catalog-header">
        <Link className="catalog-brand" to="/catalog" aria-label="News at your doorstep">
          <span className="catalog-brand-name">News</span>
          <span className="catalog-brand-tagline">News at your doorstep</span>
        </Link>
        <div className="catalog-header-actions">
          <button className="theme-toggle" type="button" onClick={() => setIsDarkTheme((dark) => !dark)}>
            {isDarkTheme ? '☀ Light mode' : '☾ Night mode'}
          </button>
          <button className="catalog-sign-out" type="button" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      {notice && <ToastMessage message={notice} onDismiss={dismissNotice} />}

      <section className="trending-hero" aria-labelledby="trending-heading">
        <div className="trending-copy">
          <p className="eyebrow">Trending now · {currentBannerArticle?.category ?? 'Top stories'}</p>
          <h1 id="trending-heading" className="featured-headline">
            {currentBannerArticle?.title ?? 'Top stories, all in one place'}
          </h1>
          <p>{currentBannerArticle?.summary ?? 'Browse the latest headlines across politics, sports, entertainment, and technology.'}</p>
          <span className="source-status">
            {currentBannerArticle?.sourceViewCount !== undefined
              ? `${currentBannerArticle.sourceViewCount.toLocaleString()} views reported by ${currentBannerArticle.source}.`
              : currentBannerArticle?.sourceRank !== undefined
                ? `Ranked #${currentBannerArticle.sourceRank} in ${(currentBannerArticle.popularitySource ?? currentBannerArticle.source)}'s top stories.`
                : currentBannerArticle
                  ? `Latest available story from ${currentBannerArticle.source}.`
                  : 'Stories will appear here as our sources provide new articles.'}
          </span>
          {currentBannerArticle?.canonicalUrl && (
            <a className="featured-read-link" href={currentBannerArticle.canonicalUrl} target="_blank" rel="noopener noreferrer">
              Read the story <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>

        <div className="trending-art" aria-label={currentBannerArticle ? `Featured ${currentBannerArticle.category} story from ${currentBannerArticle.source}` : 'Featured news story image'}>
          {currentBannerArticle ? (
            <>
              <NewsImage
                key={currentBannerArticle._id}
                className="trending-feature-image"
                src={currentBannerArticle.imageUrl}
                category={currentBannerArticle.category}
                alt=""
                onImageError={(image) => {
                  const message = image.parentElement?.querySelector('.image-unavailable');
                  if (message instanceof HTMLElement) message.hidden = false;
                }}
              />
              <p className="image-unavailable" hidden>Image could not be loaded.</p>
            </>
          ) : (
            <p className="image-unavailable">The publisher did not provide a thumbnail for this story.</p>
          )}
          <span className="trending-image-shade" aria-hidden="true" />
          {currentBannerArticle && (
            <span className="trending-image-source">
              {currentBannerArticle.source}
            </span>
          )}
          <span className="trending-number">{String(activeSlideIndex + 1).padStart(2, '0')}</span>
          <span className="trending-caption">TOP STORIES</span>
          <div className="banner-controls">
            <button type="button" aria-label="Previous top story" disabled={bannerArticles.length < 2} onClick={() => moveBanner(-1)}>‹</button>
            <span>{String(activeSlideIndex + 1).padStart(2, '0')} / {String(bannerArticles.length).padStart(2, '0')}</span>
            <button type="button" aria-label="Next top story" disabled={bannerArticles.length < 2} onClick={() => moveBanner(1)}>›</button>
          </div>
        </div>
      </section>

      <section className="catalog-articles" aria-labelledby="latest-heading">
        <div className="catalog-section-heading">
          <div>
            <p className="eyebrow">{selectedCategory === 'All' ? 'All genres' : selectedCategory}</p>
            <h2 id="latest-heading">{articleView === 'top10' ? 'Top 10 stories' : 'Latest stories'}</h2>
          </div>
          <p className="filter-help">Choose a genre and date range to find stories from our selected sources.</p>
        </div>

        <div className="region-filters" aria-label="Choose news region">
          {NEWS_REGIONS.map((region) => (
            <button
              className={selectedRegion === region ? 'is-selected' : ''}
              type="button"
              aria-pressed={selectedRegion === region}
              key={region}
              onClick={() => setSelectedRegion(region)}
            >{region}</button>
          ))}
        </div>

        <div className="category-filters" aria-label="Filter by news category">
          {['All', ...NEWS_CATEGORIES].map((category) => (
            <button
              className={selectedCategory === category ? 'is-selected' : ''}
              type="button"
              aria-pressed={selectedCategory === category}
              key={category}
              onClick={() => setSelectedCategory(category)}
            >{category === 'Technology' ? 'Tech' : category}</button>
          ))}
        </div>

        <div className="date-range-filters">
          <label>From <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label>To <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
          {(fromDate || toDate) && (
            <button type="button" onClick={() => { setFromDate(''); setToDate(''); }}>Clear dates</button>
          )}
        </div>

        <div className="article-view-filters" aria-label="Choose article list">
          <button className={articleView === 'latest' ? 'is-selected' : ''} type="button" aria-pressed={articleView === 'latest'} onClick={() => setArticleView('latest')}>Latest</button>
          <button className={articleView === 'top10' ? 'is-selected' : ''} type="button" aria-pressed={articleView === 'top10'} onClick={() => setArticleView('top10')}>Top 10</button>
        </div>

        {errorMessage && (
          <div className="articles-error" role="alert">
            <p>{errorMessage}</p>
            <button type="button" onClick={() => setRetryNumber((number) => number + 1)}>Try again</button>
          </div>
        )}

        {isLoading ? (
          <div className="articles-state" role="status">Loading news...</div>
        ) : articles.length === 0 && !errorMessage ? (
          <div className="articles-state" role="status">No stories match these filters yet.</div>
        ) : (
          <div className="article-grid">
            {articles.map((article) => (
              <Link
                className="article-card-link"
                to={`/articles/${article._id}`}
                key={article._id}
                aria-label={`Read story: ${article.title}`}
              >
                <article className="article-card">
                  <div className="article-image-frame">
                    <NewsImage
                      key={`${article._id}-${article.imageUrl ?? 'fallback'}`}
                      className="article-image"
                      src={article.imageUrl}
                      category={article.category}
                      alt=""
                      loading="lazy"
                      onImageError={(image) => {
                        const message = image.parentElement?.querySelector('.image-unavailable');
                        if (message instanceof HTMLElement) message.hidden = false;
                      }}
                    />
                    <p className="image-unavailable" hidden>Image could not be loaded.</p>
                    <span className="article-image-source">
                      {article.source}
                    </span>
                  </div>
                  <div className="article-card-content">
                    <div className="article-meta">
                      <span>{article.category}</span>
                      <time dateTime={article.publishedAt}>{formatPublishedAt(article.publishedAt)}</time>
                    </div>
                    <h3>{article.title}</h3>
                    {article.summary && <p className="article-summary">{article.summary}</p>}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default CatalogPage;
