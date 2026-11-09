import { useState, useEffect, useCallback, useRef } from "react";
import { Copy, Check, Download, ExternalLink, Trash2, Loader2, Moon, Sun } from "lucide-react";

const API_BASE_URL = import.meta.env.PROD ? "" : "http://localhost:8080";
const SHORTEN_ENDPOINT = `${API_BASE_URL}/api/v1/shorten`;
const HISTORY_STORAGE_KEY = "url-shortener-history";
const THEME_STORAGE_KEY = "url-shortener-theme";
const APP_NAME = "trim";
const MAX_HISTORY_ITEMS = 12;
const REPO_URL = "https://github.com/tejas-j20/url-shortener";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const smallButton = `inline-flex items-center gap-1.5 rounded-md border border-line bg-page px-3 py-2 text-sm font-medium text-ink hover:bg-panel ${focusRing}`;
const iconButton = `inline-flex items-center justify-center rounded-md border border-line bg-page p-2.5 text-muted hover:bg-panel hover:text-ink ${focusRing}`;

function normalizeUrl(rawInput) {
  const trimmed = rawInput.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isValidUrl(candidate) {
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname;
    if (!host) return false;
    if (host === "localhost") return true;
    return (
      /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(host) ||
      /^(\d{1,3}\.){3}\d{1,3}$/.test(host)
    );
  } catch {
    return false;
  }
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function getQrCodeUrl(targetUrl, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(targetUrl)}`;
}

function messageForStatus(status) {
  if (status === 400) {
    return "That doesn't look like a valid web address. Use a link starting with http:// or https://.";
  }
  if (status >= 500) return "The server had a problem. Try again in a moment.";
  return `Something went wrong (error ${status}).`;
}

function loadHistoryFromStorage() {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistoryToStorage(history) {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // storage full or unavailable: history just won't persist
  }
}

function getInitialTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function CopyButton({ text, id, copiedKey, onCopy }) {
  const done = copiedKey === id;
  return (
    <button type="button" onClick={() => onCopy(text, id)} className={smallButton}>
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export default function UrlShortenerApp() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [copiedKey, setCopiedKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [theme, setTheme] = useState(getInitialTheme);
  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    setHistory(loadHistoryFromStorage());
  }, []);

  const addToHistory = useCallback((item) => {
    setHistory((prev) => {
      const filtered = prev.filter((e) => e.fullShortUrl !== item.fullShortUrl);
      const updated = [item, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveHistoryToStorage(updated);
      return updated;
    });
  }, []);

  const removeFromHistory = useCallback((shortLink) => {
    setHistory((prev) => {
      const updated = prev.filter((e) => e.shortLink !== shortLink);
      saveHistoryToStorage(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistoryToStorage([]);
  }, []);

  const handleCopy = useCallback(async (text, key) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const box = document.createElement("textarea");
        box.value = text;
        box.style.position = "fixed";
        box.style.opacity = "0";
        document.body.appendChild(box);
        box.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(box);
        if (!ok) throw new Error("copy failed");
      }
      setCopiedKey(key);
      window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setError("Couldn't copy automatically. Select the link and copy it by hand.");
    }
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError(null);

      const normalized = normalizeUrl(url);
      if (!normalized) {
        setError("Enter a link to shorten.");
        return;
      }
      if (!isValidUrl(normalized)) {
        setError("That doesn't look like a valid web address.");
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(SHORTEN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ originalUrl: normalized }),
        });
        if (!response.ok) throw new Error(messageForStatus(response.status));

        const data = await response.json();
        const item = {
          originalUrl: data.originalUrl ?? normalized,
          shortLink: data.shortLink ?? "",
          fullShortUrl: data.fullShortUrl ?? "",
          createdAt: data.createdAt ?? new Date().toISOString(),
        };
        setResult(item);
        addToHistory(item);
        setUrl("");
      } catch (err) {
        setError(
          err instanceof TypeError
            ? "Can't reach the server. Check that the backend is running."
            : err.message
        );
      } finally {
        setIsLoading(false);
      }
    },
    [url, addToHistory]
  );

  const query = searchQuery.toLowerCase();
  const filteredHistory = history.filter(
    (item) =>
      item.originalUrl.toLowerCase().includes(query) ||
      item.fullShortUrl.toLowerCase().includes(query)
  );
  const saved = result ? result.originalUrl.length - result.fullShortUrl.length : 0;

  return (
    <div className="min-h-screen bg-desk sm:p-6 lg:p-10">
      <div className="mx-auto w-full max-w-5xl overflow-hidden border-line bg-page sm:rounded-xl sm:border">
        <header className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-8">
          <span className="font-mono text-lg font-medium">{APP_NAME}</span>
          <div className="flex items-center gap-4">
            <a href={REPO_URL} className={`text-sm text-muted underline hover:text-ink ${focusRing}`}>
              Source on GitHub
            </a>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              className={iconButton}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <main className="px-5 py-8 sm:px-8 sm:py-10">
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Paste a long link.
              <br />
              Get a short one.
            </h1>
            <p className="mt-4 text-muted">Every short link comes with a QR code you can download.</p>

            <form onSubmit={handleSubmit} className="mt-8" noValidate>
              <label htmlFor="long-url" className="mb-2 block text-sm font-medium">
                Long link
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="long-url"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="https://example.com/a/very/long/page"
                  aria-invalid={error ? "true" : "false"}
                  aria-describedby={error ? "url-error" : undefined}
                  className={`min-w-0 flex-1 rounded-md border border-ink bg-page px-4 py-3 font-mono text-base placeholder:text-muted sm:text-sm ${focusRing}`}
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`inline-flex items-center justify-center gap-2 rounded-md bg-ink px-6 py-3 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
                >
                  {isLoading && <Loader2 size={16} className="animate-spin" />}
                  {isLoading ? "Shortening" : "Shorten link"}
                </button>
              </div>
              {error && (
                <p id="url-error" role="alert" className="mt-3 text-sm font-medium text-danger">
                  {error}
                </p>
              )}
            </form>

            {result && (
              <section aria-live="polite" className="mt-8 rounded-lg border border-line bg-panel p-5">
                <h2 className="text-sm font-medium text-muted">Short link created</h2>
                <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href={result.fullShortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`box-decoration-clone break-all bg-highlight px-1.5 font-mono text-lg font-medium text-on-highlight ${focusRing}`}
                      >
                        {result.fullShortUrl}
                      </a>
                      <CopyButton text={result.fullShortUrl} id="result" copiedKey={copiedKey} onCopy={handleCopy} />
                    </div>
                    <p className="mt-4 break-all text-sm text-muted">{result.originalUrl}</p>
                    <p className="mt-1 text-sm text-muted">
                      {saved > 0 &&
                        `${result.originalUrl.length} → ${result.fullShortUrl.length} characters (${saved} fewer). `}
                      Created {formatDate(result.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-center">
                    <img
                      src={getQrCodeUrl(result.fullShortUrl)}
                      alt="QR code for the short link"
                      width="128"
                      height="128"
                      className="rounded-md border border-line bg-white p-2"
                    />
                    <a
                      href={getQrCodeUrl(result.fullShortUrl, 512)}
                      download="qr-code.png"
                      className={`inline-flex items-center gap-1.5 text-sm font-medium underline ${focusRing}`}
                    >
                      <Download size={14} />
                      Download QR code
                    </a>
                  </div>
                </div>
              </section>
            )}
          </main>

          <aside className="border-t border-line bg-panel/50 px-5 py-8 sm:px-8 sm:py-10 lg:border-l lg:border-t-0">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink pb-2">
              <h2 className="text-lg font-semibold">
                Recent links{history.length > 0 && <span className="ml-2 text-muted">{history.length}</span>}
              </h2>
              {history.length > 0 && (
                <button type="button" onClick={clearHistory} className={`text-sm text-muted underline hover:text-danger ${focusRing}`}>
                  Clear all
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-muted">Saved in this browser only.</p>

            {history.length > 4 && (
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter links"
                aria-label="Filter recent links"
                className={`mt-4 w-full rounded-md border border-line bg-page px-3 py-2 text-base sm:text-sm ${focusRing}`}
              />
            )}

            {history.length === 0 ? (
              <p className="mt-6 text-muted">Links you shorten will show up here.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line lg:max-h-[34rem] lg:overflow-y-auto">
                {filteredHistory.map((item) => (
                  <li
                    key={item.shortLink || item.fullShortUrl}
                    className="flex flex-col gap-3 py-4 xl:flex-row xl:items-center xl:justify-between"
                  >
                    <div className="min-w-0">
                      <a
                        href={item.fullShortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`break-all font-mono text-sm font-medium underline ${focusRing}`}
                      >
                        {item.fullShortUrl}
                      </a>
                      <p className="truncate text-sm text-muted">{item.originalUrl}</p>
                      <p className="text-xs text-muted">{formatDate(item.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <CopyButton text={item.fullShortUrl} id={item.shortLink} copiedKey={copiedKey} onCopy={handleCopy} />
                      <a
                        href={item.fullShortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open link in a new tab"
                        className={iconButton}
                      >
                        <ExternalLink size={16} />
                      </a>
                      <button
                        type="button"
                        onClick={() => removeFromHistory(item.shortLink)}
                        aria-label="Remove from recent links"
                        className={iconButton}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}