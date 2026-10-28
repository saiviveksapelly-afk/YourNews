import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { clearAuthToken, getAuthToken } from '../auth/authToken.ts';
import NewsImage from '../components/NewsImage.tsx';
import type { NewsArticle } from '../types/newsArticle.ts';
import './ArticlePage.css';

function ArticlePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDarkTheme, setIsDarkTheme] = useState(
    () => localStorage.getItem('catalog-theme') === 'dark',
  );

  useEffect(() => {
    let requestIsCurrent = true;

    async function loadArticle() {
      if (!id) {
        setErrorMessage('This story link is incomplete. Return to the news catalog and choose another story.');
        setIsLoading(false);
        return;
      }

      const token = getAuthToken();
      if (!token) {
        navigate('/login', { replace: true, state: { notice: 'Please sign in to read this story.' } });
        return;
      }

      try {
        const response = await fetch(`/api/articles/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!requestIsCurrent) return;
        if (response.status === 401) {
          clearAuthToken();
          navigate('/login', { replace: true, state: { notice: 'Your sign-in has expired. Please sign in again.' } });
          return;
        }
        if (response.status === 404) {
          setErrorMessage('This story may have expired or is no longer available. Return to the catalog to browse current news.');
          return;
        }
        if (!response.ok) {
          setErrorMessage("We couldn't load this story. Please try again.");
          return;
        }

        const data = (await response.json()) as { article?: NewsArticle };
        if (!data.article) {
          setErrorMessage("We couldn't read this story. Please return to the catalog and try another one.");
          return;
        }
        setArticle(data.article);
      } catch {
        if (requestIsCurrent) {
          setErrorMessage("We couldn't connect to the news service. Check your connection and try again.");
        }
      } finally {
        if (requestIsCurrent) setIsLoading(false);
      }
    }

    void loadArticle();
    return () => { requestIsCurrent = false; };
  }, [id, navigate]);

  useEffect(() => {
    localStorage.setItem('catalog-theme', isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme]);

  return (
    <main className={`article-page ${isDarkTheme ? 'theme-dark' : 'theme-light'}`}>
      <header className="article-page-header">
        <Link className="article-page-brand" to="/catalog">
          <span>News</span>
          <small>News at your doorstep</small>
        </Link>
        <div className="article-page-actions">
          <button className="article-theme-toggle" type="button" onClick={() => setIsDarkTheme((dark) => !dark)}>
            {isDarkTheme ? '☀ Light mode' : '☾ Night mode'}
          </button>
          <Link className="back-to-catalog" to="/catalog">← Back to news</Link>
        </div>
      </header>

      <div className="article-page-body">
        {isLoading ? (
          <p className="article-page-state" role="status">Loading this story…</p>
        ) : errorMessage ? (
          <section className="article-page-state" role="alert">
            <p>{errorMessage}</p>
            <Link to="/catalog">Browse the news catalog</Link>
          </section>
        ) : article ? (
          <article className="full-article">
            <div className="full-article-heading">
              <p className="article-kicker">{article.category} · {article.region}</p>
              <h1>{article.title}</h1>
              <div className="full-article-byline">
                <span>{article.source}</span>
                {article.author && <span>By {article.author}</span>}
                <time dateTime={article.publishedAt}>
                  {new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(article.publishedAt))}
                </time>
              </div>
            </div>

            <figure className="full-article-image-wrap">
              <NewsImage
                className="full-article-image"
                src={article.imageUrl}
                category={article.category}
                alt=""
                onImageError={(image) => {
                  const message = image.parentElement?.querySelector('.article-image-note');
                  if (message instanceof HTMLElement) message.hidden = false;
                }}
              />
              <p className="article-image-note" hidden>Image could not be loaded.</p>
              <figcaption>{article.source}</figcaption>
            </figure>

            <div className="full-article-content">
              {article.content ? (
                <div className="article-body-copy">{article.content}</div>
              ) : article.summary ? (
                <p className="article-summary-copy">{article.summary}</p>
              ) : (
                <p className="article-summary-copy">
                  This source does not provide article text to the catalog. Open the publisher’s page to read the complete story.
                </p>
              )}
              {article.canonicalUrl && (
                <a className="publisher-story-link" href={article.canonicalUrl} target="_blank" rel="noopener noreferrer">
                  Read the full story at {article.source} <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </article>
        ) : null}
      </div>
    </main>
  );
}

export default ArticlePage;
