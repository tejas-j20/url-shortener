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
} from "lucide-react";

const API_BASE_URL = "http://localhost:8080";
const SHORTEN_ENDPOINT = `${API_BASE_URL}/api/v1/shorten`;
const HISTORY_STORAGE_KEY = "url-shortener-history";
const MAX_HISTORY_ITEMS = 8;

/** Prepends https:// when the user omits a protocol, so "example.com" still works. */
function normalizeUrl(rawInput) {
  const trimmed = rawInput.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Validates that a string is a well-formed, plausible http(s) URL. */
function isValidUrl(candidate) {
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

    const host = parsed.hostname;
    if (!host) return false;
    if (host === "localhost") return true;

    const isDomain = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(host);
    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    return isDomain || isIPv4;
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

function getQrCodeUrl(targetUrl, size = 180) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    targetUrl
  )}`;
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
    // localStorage might be full or disabled; fail silently, it's non-critical
  }
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed top-5 right-5 z-50 max-w-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/90 px-4 py-3 text-red-100 shadow-2xl shadow-black/40 backdrop-blur">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
        <p className="text-sm leading-snug">{message}</p>
        <button
          onClick={onClose}
          className="ml-auto flex-shrink-0 rounded-md p-1 text-red-300 transition-colors hover:bg-red-900/60 hover:text-red-100"
          aria-label="Dismiss error"
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
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
        isCopied
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-slate-800 text-slate-200 hover:bg-slate-700"
      } ${className}`}
    >
      {isCopied ? (
        <>
          <Check className="h-4 w-4" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          Copy
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

  useEffect(() => {
    return () => {
      window.clearTimeout(copyTimeoutRef.current);
      window.clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  const addToHistory = useCallback((item) => {
    setHistory((prev) => {
      const withoutDuplicate = prev.filter((entry) => entry.fullShortUrl !== item.fullShortUrl);
      const next = [item, ...withoutDuplicate].slice(0, MAX_HISTORY_ITEMS);
      saveHistoryToStorage(next);
      return next;
    });
  }, []);

  const removeFromHistory = useCallback((shortLink) => {
    setHistory((prev) => {
      const next = prev.filter((entry) => entry.shortLink !== shortLink);
      saveHistoryToStorage(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistoryToStorage([]);
  }, []);

  const handleCopy = useCallback(async (text, key) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
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
      setError("Couldn't copy to clipboard. Please copy it manually.");
    }
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setError(null);

      const normalized = normalizeUrl(url);

      if (!normalized) {
        setError("Please enter a URL to shorten.");
        return;
      }

      if (!isValidUrl(normalized)) {
        setError("That doesn't look like a valid URL. Try something like https://example.com");
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
          let message = `Request failed with status ${response.status}.`;
          try {
            const text = await response.text();
            if (text) message = text;
          } catch {
            // keep default message if body can't be read
          }
          throw new Error(message);
        }

        const data = await response.json();
        const enrichedResult = {
          originalUrl: data.originalUrl ?? normalized,
          shortLink: data.shortLink ?? "",
          fullShortUrl: data.fullShortUrl ?? "",
          createdAt: data.createdAt ?? new Date().toISOString(),
        };

        setResult(enrichedResult);
        addToHistory(enrichedResult);
        setUrl("");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while shortening your URL. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [url, addToHistory]
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-purple-600/10 blur-3xl" />

      <Toast message={error} onClose={() => setError(null)} />

      <main className="relative z-10 mx-auto max-w-2xl px-4 py-14 md:py-20">
        <section className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            Fast, free URL shortening
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Shorten links,{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              instantly
            </span>
          </h1>
          <p className="mt-3 text-slate-400">
            Paste a long URL below and get a short, shareable link in seconds.
          </p>
        </section>

        <form
          onSubmit={handleSubmit}
          className="mt-8 flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-2 shadow-xl shadow-black/20 backdrop-blur transition-colors focus-within:border-indigo-500/50 sm:flex-row"
        >
          <div className="flex flex-1 items-center gap-2 px-3">
            <Link2 className="h-5 w-5 flex-shrink-0 text-slate-500" />
            <input
              type="text"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://your-long-url.com/goes-here"
              aria-label="URL to shorten"
              autoFocus
              className="w-full bg-transparent py-3 text-slate-100 placeholder-slate-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white shadow-lg shadow-indigo-900/30 transition-colors duration-200 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-600/50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Shortening...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" />
                Shorten URL
              </>
            )}
          </button>
        </form>

        {result && (
          <section className="mt-6 rounded-2xl border border-emerald-500/20 bg-slate-900/60 p-5 shadow-lg shadow-black/20 md:p-6">
            <div className="flex flex-col gap-6 md:flex-row md:justify-between">
              <div className="min-w-0 flex-1">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                  <Check className="h-4 w-4" />
                  Your short link is ready
                </p>

                <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <Link2 className="h-4 w-4 flex-shrink-0 text-indigo-400" />
                  <a
                    href={result.fullShortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate font-medium text-indigo-300 hover:underline"
                  >
                    {result.fullShortUrl}
                  </a>
                  <CopyButton
                    text={result.fullShortUrl}
                    copyKey="result"
                    activeKey={copiedKey}
                    onCopy={handleCopy}
                  />
                </div>

                <div className="mt-3 space-y-1 text-sm text-slate-500">
                  <p className="flex items-center gap-1.5 truncate">
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{result.originalUrl}</span>
                  </p>
                  {result.createdAt && (
                    <p className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      Created {formatDate(result.createdAt)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-shrink-0 flex-col items-center gap-2">
                <div className="rounded-xl border border-slate-800 bg-white p-2">
                  <img
                    src={getQrCodeUrl(result.fullShortUrl)}
                    alt={`QR code for ${result.fullShortUrl}`}
                    width={140}
                    height={140}
                    className="h-[140px] w-[140px]"
                  />
                </div>
                <a
                  href={getQrCodeUrl(result.fullShortUrl, 512)}
                  download={`qr-${result.shortLink || "code"}.png`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-indigo-400"
                >
                  <Download className="h-4 w-4" />
                  Download QR
                </a>
              </div>
            </div>
          </section>
        )}

        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200">
              <History className="h-5 w-5 text-slate-500" />
              Recent Links
              {history.length > 0 && (
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
                  {history.length}
                </span>
              )}
            </h2>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-6 py-10 text-center">
              <QrCode className="mx-auto mb-2 h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-500">
                No links yet — shorten one above to see it here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
              {history.map((item) => (
                <li
                  key={item.shortLink || item.fullShortUrl}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={item.fullShortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate font-medium text-indigo-300 hover:underline"
                    >
                      {item.fullShortUrl}
                    </a>
                    <p className="truncate text-sm text-slate-500">{item.originalUrl}</p>
                    {item.createdAt && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-600">
                        <Clock className="h-3 w-3" />
                        {formatDate(item.createdAt)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(item.fullShortUrl, item.shortLink)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                      aria-label="Copy link"
                    >
                      {copiedKey === item.shortLink ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <a
                      href={item.fullShortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                      aria-label="Open link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => removeFromHistory(item.shortLink)}
                      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-950/40 hover:text-red-400"
                      aria-label="Remove from history"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
