import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Link2,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Download,
  History,
  Trash2,
  ExternalLink,
  X,
  Sparkles,
  Clock,
  QrCode,
  Search,
  BarChart2,
  Zap,
  ShieldCheck,
  Globe,
  ArrowRight,
} from "lucide-react";

const API_BASE_URL = "";
const SHORTEN_ENDPOINT = `${API_BASE_URL}/api/v1/shorten`;
const HISTORY_STORAGE_KEY = "url-shortener-history";
const MAX_HISTORY_ITEMS = 12;

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
    return /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(host) || /^(\d{1,3}\.){3}\d{1,3}$/.test(host);  } catch {
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
    // LocalStorage quota fallback
  }
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md animate-bounce-in">
      <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/90 p-4 text-red-100 shadow-2xl backdrop-blur-md">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
        <div className="flex-1 text-sm leading-snug">{message}</div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-red-300 transition-colors hover:bg-red-900/50 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CopyButton({ text, copyKey, activeKey, onCopy, className = "" }) {
  const isCopied = activeKey === copyKey;
  return (
    <button
      type="button"
      onClick={() => onCopy(text, copyKey)}
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
        isCopied
          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
          : "bg-slate-800/80 text-slate-200 hover:bg-slate-700 border border-slate-700/50"
      } ${className}`}
    >
      {isCopied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>Copy</span>
        </>
      )}
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

  const copyTimeoutRef = useRef(null);
  const errorTimeoutRef = useRef(null);

  useEffect(() => {
    setHistory(loadHistoryFromStorage());
  }, []);

  useEffect(() => {
    if (!error) return;
    window.clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(errorTimeoutRef.current);
  }, [error]);

  const addToHistory = useCallback((item) => {
    setHistory((prev) => {
      const filtered = prev.filter((entry) => entry.fullShortUrl !== item.fullShortUrl);
      const updated = [item, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveHistoryToStorage(updated);
      return updated;
    });
  }, []);

  const removeFromHistory = useCallback((shortLink) => {
    setHistory((prev) => {
      const updated = prev.filter((entry) => entry.shortLink !== shortLink);
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
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedKey(key);
      window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setError("Unable to copy to clipboard automatically.");
    }
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError(null);

      const normalized = normalizeUrl(url);
      if (!normalized) {
        setError("Please enter a URL to shorten.");
        return;
      }
      if (!isValidUrl(normalized)) {
        setError("Please enter a valid HTTP or HTTPS URL.");
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(SHORTEN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ originalUrl: normalized }),
        });

        if (!response.ok) {
          let msg = `Server returned status ${response.status}`;
          try {
            const txt = await response.text();
            if (txt) msg = txt;
          } catch {}
          throw new Error(msg);
        }

        const data = await response.json();
        const enriched = {
          originalUrl: data.originalUrl ?? normalized,
          shortLink: data.shortLink ?? "",
          fullShortUrl: data.fullShortUrl ?? "",
          createdAt: data.createdAt ?? new Date().toISOString(),
          clicks: Math.floor(Math.random() * 24) + 1, // Mock analytics counter for demo
        };

        setResult(enriched);
        addToHistory(enriched);
        setUrl("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to shorten URL.");
      } finally {
        setIsLoading(false);
      }
    },
    [url, addToHistory]
  );

  const filteredHistory = history.filter(
    (item) =>
      item.originalUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.fullShortUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-x-hidden">
      {/* Background Lighting Visuals */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-tr from-indigo-600/20 to-purple-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 -right-40 h-[400px] w-[400px] rounded-full bg-blue-600/10 blur-[100px]" />

      <Toast message={error} onClose={() => setError(null)} />

      {/* Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20">
              <Link2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              Trim<span className="text-indigo-400">URL</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              API v1 Operational
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        {/* Hero Section */}
        <section className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            Modern Link Management Engine
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-white">
            Shorten links, <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              amplify your reach.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-400 sm:text-lg">
            Create fast, secure, and trackable short URLs with built-in QR code generation in seconds.
          </p>
        </section>

        {/* Input Form Card */}
        <div className="mt-8">
          <form
            onSubmit={handleSubmit}
            className="group relative flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-2.5 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-300 focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20 sm:flex-row"
          >
            <div className="flex flex-1 items-center gap-3 px-3 py-2">
              <Globe className="h-5 w-5 text-slate-500 transition-colors group-focus-within:text-indigo-400" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste your long link here (e.g. https://example.com/long-page)..."
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none sm:text-base"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-600/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Shortening...</span>
                </>
              ) : (
                <>
                  <span>Shorten URL</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Shortened URL Result Card */}
        {result && (
          <div className="mt-8 animate-fade-in rounded-2xl border border-indigo-500/30 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <Check className="h-4 w-4" />
                  Link Created Successfully
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                  <Link2 className="h-5 w-5 flex-shrink-0 text-indigo-400" />
                  <a
                    href={result.fullShortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 truncate text-base font-semibold text-indigo-300 hover:underline"
                  >
                    {result.fullShortUrl}
                  </a>
                  <CopyButton
                    text={result.fullShortUrl}
                    copyKey="result-main"
                    activeKey={copiedKey}
                    onCopy={handleCopy}
                  />
                </div>

                <div className="space-y-1.5 text-xs text-slate-400">
                  <p className="flex items-center gap-2 truncate">
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
                    <span className="truncate">{result.originalUrl}</span>
                  </p>
                  <p className="flex items-center gap-2 text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Created {formatDate(result.createdAt)}</span>
                  </p>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <img
                  src={getQrCodeUrl(result.fullShortUrl)}
                  alt="Short link QR code"
                  className="h-32 w-32 rounded-lg bg-white p-2 shadow-md"
                />
                <a
                  href={getQrCodeUrl(result.fullShortUrl, 512)}
                  download="qr-code.png"
                  className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PNG
                </a>
              </div>
            </div>
          </div>
        )}

        {/* History / Recent Links Section */}
        <section className="mt-14">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 border border-slate-800">
                <History className="h-4 w-4 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">Recent Links</h2>
              {history.length > 0 && (
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
                  {history.length}
                </span>
              )}
            </div>

            {history.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search recent links..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-red-500/30 hover:bg-red-950/30 hover:text-red-400 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear All
                </button>
              </div>
            )}
          </div>

          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center">
              <QrCode className="mx-auto h-10 w-10 text-slate-700" />
              <h3 className="mt-3 text-sm font-semibold text-slate-300">No shortened URLs yet</h3>
              <p className="mt-1 text-xs text-slate-500">
                Paste your long links into the box above to generate short URLs and track them here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => (
                <div
                  key={item.shortLink || item.fullShortUrl}
                  className="group flex flex-col justify-between gap-4 rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 transition-all duration-200 hover:border-slate-700 hover:bg-slate-900 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <a
                        href={item.fullShortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-bold text-indigo-300 hover:underline"
                      >
                        {item.fullShortUrl}
                      </a>
                    </div>
                    <p className="truncate text-xs text-slate-400">{item.originalUrl}</p>
                    <p className="text-[11px] text-slate-500">{formatDate(item.createdAt)}</p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <CopyButton
                      text={item.fullShortUrl}
                      copyKey={item.shortLink}
                      activeKey={copiedKey}
                      onCopy={handleCopy}
                    />
                    <a
                      href={item.fullShortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-800 bg-slate-800/60 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                      title="Open URL"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => removeFromHistory(item.shortLink)}
                      className="rounded-lg border border-slate-800 bg-slate-800/60 p-2 text-slate-500 hover:border-red-500/30 hover:bg-red-950/30 hover:text-red-400 transition-colors"
                      title="Delete link"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Product Feature Grid */}
        <section className="mt-20 border-t border-slate-800/80 pt-12">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">Lightning Fast</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Powered by optimized redirect routing ensuring sub-millisecond redirection for your visitors.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">Secure & Reliable</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                All generated links are encrypted via HTTPS and checked against safety blacklists.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400">
                <BarChart2 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">QR Code Ready</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Automatically generate high-resolution vector QR codes ready for digital or print campaigns.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/60 py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} TrimURL. Open source URL shortening application.</p>
      </footer>
    </div>
  );
}