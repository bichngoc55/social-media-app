"use client";

import { SearchIcon, X, Loader2, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Input } from "./ui/input";
import useDebounce from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  content: string;
  similarity?: number;
}

interface SearchHistory {
  query: string;
  timestamp: number;
}

const SEARCH_HISTORY_KEY = "search_history";
const MAX_HISTORY_ITEMS = 10;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// In-memory cache for search results
const searchCache = new Map<
  string,
  { data: Suggestion[]; timestamp: number }
>();

export default function SearchField() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const debouncedQuery = useDebounce(query, 250); // Reduced from 300ms
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load search history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchHistory[];
        // Filter out old entries (older than 30 days)
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const filtered = parsed.filter(
          (item) => item.timestamp > thirtyDaysAgo
        );
        setSearchHistory(filtered.slice(0, MAX_HISTORY_ITEMS));
      }
    } catch (error) {
      console.error("Error loading search history:", error);
    }
  }, []);

  // Save search to history
  const saveToHistory = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setSearchHistory((prev) => {
      // Remove duplicate if exists
      const filtered = prev.filter((item) => item.query !== searchQuery);
      // Add new search at the beginning
      const updated = [
        { query: searchQuery, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_HISTORY_ITEMS);

      // Save to localStorage
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Error saving search history:", error);
      }

      return updated;
    });
  }, []);

  // Clear search history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error("Error clearing search history:", error);
    }
  }, []);

  // Fetch suggestions with caching and abort
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedQuery.length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        setShowHistory(false);
        return;
      }

      // Check cache first
      const cached = searchCache.get(debouncedQuery);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setSuggestions(cached.data);
        setIsOpen(cached.data.length > 0);
        setShowHistory(false);
        return;
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setIsLoading(true);
      try {
        // --- MISSING PART ADDED BELOW ---

        // Replace '/api/search' with your actual endpoint
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(debouncedQuery)}`,
          {
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) throw new Error("Search failed");

        const data = await response.json();

        // Update State
        setSuggestions(data); // Assuming data is Suggestion[]
        setIsOpen(data.length > 0);
        setShowHistory(false);

        // Save to Cache
        searchCache.set(debouncedQuery, {
          data: data,
          timestamp: Date.now(),
        });
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.log("Query cancelled");
        } else {
          console.error("Search error:", error);
          setSuggestions([]); // Optional: clear suggestions on error
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) return;
    saveToHistory(query.trim());
    router.push(`/search?q=${encodeURIComponent(query)}`);
    setIsOpen(false);
    setShowHistory(false);
  }

  const handleHistoryClick = useCallback(
    (historyQuery: string) => {
      setQuery(historyQuery);
      router.push(`/search?q=${encodeURIComponent(historyQuery)}`);
      setIsOpen(false);
      setShowHistory(false);
    },
    [router]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: Suggestion) => {
      saveToHistory(query.trim());
      router.push(`/posts/${suggestion.id}`);
      setQuery("");
      setIsOpen(false);
      setShowHistory(false);
    },
    [query, router, saveToHistory]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const itemCount = showHistory ? searchHistory.length : suggestions.length;

    if (!isOpen || itemCount === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < itemCount - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (showHistory && selectedIndex >= 0) {
          handleHistoryClick(searchHistory[selectedIndex].query);
        } else if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        } else if (query.trim()) {
          saveToHistory(query.trim());
          router.push(`/search?q=${encodeURIComponent(query)}`);
          setIsOpen(false);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setShowHistory(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <form onSubmit={handleSubmit} method="GET" action="/search">
      <div ref={containerRef} className="relative w-full">
        <Input
          name="q"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
            setShowHistory(false);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.length === 0 && searchHistory.length > 0) {
              setShowHistory(true);
              setIsOpen(true);
            } else if (suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder="Search"
          className="border-white/30 bg-white/20 pe-10 backdrop-blur-sm transition-all duration-300 placeholder:text-gray-600 focus:bg-white/30"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 transform">
          {isLoading ? (
            <Loader2 className="size-5 animate-spin text-gray-600" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setIsOpen(false);
              }}
              className="text-gray-600 hover:text-gray-800"
            >
              <X className="size-5" />
            </button>
          ) : (
            <SearchIcon className="size-5 text-gray-600" />
          )}
        </div>

        {/* Search History Dropdown */}
        {isOpen && showHistory && searchHistory.length > 0 && (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                Recent Searches
              </span>
              <button
                onClick={clearHistory}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {searchHistory.map((item, index) => (
                <button
                  key={item.timestamp}
                  onClick={() => handleHistoryClick(item.query)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b p-3 text-left transition-colors last:border-b-0",
                    selectedIndex === index ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.query}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions Dropdown */}
        {isOpen && !showHistory && suggestions.length > 0 && (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border bg-card shadow-lg">
            <div className="max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={cn(
                    "flex w-full items-start gap-2 border-b p-3 text-left transition-colors last:border-b-0",
                    selectedIndex === index ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm">{suggestion.content}</p>
                    {suggestion.similarity !== undefined && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(suggestion.similarity * 100).toFixed(0)}% match
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
