import { MikaCliError } from "../../../errors.js";

export const WEB_SEARCH_ENGINES = ["duckduckgo", "bing", "brave", "google", "yahoo", "yandex", "baidu"] as const;

export type WebSearchEngine = (typeof WEB_SEARCH_ENGINES)[number];

export type WebSearchResult = {
  title: string;
  url: string;
  snippet?: string;
  fetchedSummary?: string;
  engine: WebSearchEngine;
};

export type WebSearchEngineInfo = {
  id: WebSearchEngine;
  label: string;
  description: string;
  searchUrl(query: string): string;
};

export const WEB_SEARCH_ENGINE_INFO: Record<WebSearchEngine, WebSearchEngineInfo> = {
  duckduckgo: {
    id: "duckduckgo",
    label: "DuckDuckGo",
    description: "Default terminal-friendly web search via DuckDuckGo HTML results",
    searchUrl(query: string): string {
      return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    },
  },
  bing: {
    id: "bing",
    label: "Bing",
    description: "Microsoft Bing web search",
    searchUrl(query: string): string {
      return `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en-US&mkt=en-US&cc=us&ensearch=1`;
    },
  },
  brave: {
    id: "brave",
    label: "Brave Search",
    description: "Brave Search web results",
    searchUrl(query: string): string {
      return `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
    },
  },
  google: {
    id: "google",
    label: "Google",
    description: "Google web search via the basic HTML view",
    searchUrl(query: string): string {
      return `https://www.google.com/search?hl=en&gbv=1&q=${encodeURIComponent(query)}`;
    },
  },
  yahoo: {
    id: "yahoo",
    label: "Yahoo Search",
    description: "Yahoo web search results",
    searchUrl(query: string): string {
      return `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&fr2=sb-top&ei=UTF-8`;
    },
  },
  yandex: {
    id: "yandex",
    label: "Yandex",
    description: "Yandex web search results",
    searchUrl(query: string): string {
      return `https://yandex.com/search/?text=${encodeURIComponent(query)}&lr=0`;
    },
  },
  baidu: {
    id: "baidu",
    label: "Baidu",
    description: "Baidu web search results",
    searchUrl(query: string): string {
      return `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&ie=utf-8`;
    },
  },
};

export function normalizeWebSearchEngine(value: string | undefined): WebSearchEngine {
  if (!value || value.trim().length === 0) {
    return "duckduckgo";
  }

  const normalized = value.trim().toLowerCase();
  if ((WEB_SEARCH_ENGINES as readonly string[]).includes(normalized)) {
    return normalized as WebSearchEngine;
  }

  throw new MikaCliError(
    "WEBSEARCH_ENGINE_INVALID",
    `Unknown search engine "${value}". Supported engines: ${WEB_SEARCH_ENGINES.join(", ")}.`,
    {
      details: {
        engine: value,
        supportedEngines: WEB_SEARCH_ENGINES,
      },
    },
  );
}

export function getWebSearchEngineInfo(engine: WebSearchEngine): WebSearchEngineInfo {
  return WEB_SEARCH_ENGINE_INFO[engine];
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

export function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function absoluteSearchResultUrl(href: string, pageUrl: string): string | undefined {
  const trimmed = decodeHtmlEntities(href).trim();
  if (!trimmed || /^javascript:/i.test(trimmed) || /^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed) || trimmed.startsWith("#")) {
    return undefined;
  }

  try {
    const resolvedUrl = new URL(trimmed, pageUrl);

    if (resolvedUrl.pathname === "/url") {
      const target = resolvedUrl.searchParams.get("q") ?? resolvedUrl.searchParams.get("url");
      if (target) {
        return target;
      }
    }

    if (resolvedUrl.pathname === "/l/" || resolvedUrl.pathname === "/l") {
      const target = resolvedUrl.searchParams.get("uddg") ?? resolvedUrl.searchParams.get("u");
      if (target) {
        return target;
      }
    }

    if (resolvedUrl.pathname === "/ck/a" || resolvedUrl.pathname === "/ck") {
      const target = decodeBingRedirectTarget(resolvedUrl.searchParams.get("u"));
      if (target) {
        return target;
      }
    }

    if (resolvedUrl.hostname === "r.search.yahoo.com") {
      const fromPath = resolvedUrl.pathname.match(/\/RU=([^/]+)(?:\/|$)/i)?.[1];
      const fromQuery = resolvedUrl.searchParams.get("RU");
      const target = decodeHtmlEntities(fromPath ?? fromQuery ?? "");
      if (target) {
        try {
          return decodeURIComponent(target);
        } catch {
          return target;
        }
      }
    }

    if (/\.?yandex\./i.test(resolvedUrl.hostname) && resolvedUrl.pathname.includes("/clck/jsredir")) {
      const target = resolvedUrl.searchParams.get("url") ?? resolvedUrl.searchParams.get("target");
      if (target) {
        return target;
      }
    }

    if (/\.?baidu\.com$/i.test(resolvedUrl.hostname) && resolvedUrl.pathname === "/link") {
      const target = resolvedUrl.searchParams.get("url") ?? resolvedUrl.searchParams.get("target");
      if (target && /^https?:\/\//i.test(target)) {
        return target;
      }
    }

    return resolvedUrl.toString();
  } catch {
    return undefined;
  }
}

export function isUsefulSearchResult(url: string, title: string, engineUrl: string): boolean {
  if (!url || !title) {
    return false;
  }

  try {
    const target = new URL(url);
    const engineHost = new URL(engineUrl).hostname.replace(/^www\./, "");
    const targetHost = target.hostname.replace(/^www\./, "");
    if (targetHost === engineHost) {
      return false;
    }
  } catch {
    return false;
  }

  return !/^https?:\/\/(duckduckgo\.com|html\.duckduckgo\.com|bing\.com|search\.brave\.com|google\.com|search\.yahoo\.com|r\.search\.yahoo\.com|(?:www\.)?yandex\.(?:com|ru|by|kz|uz|com\.tr)|(?:www\.)?baidu\.com)\b/i.test(url);
}

export function dedupeWebSearchResults(results: WebSearchResult[], limit: number): WebSearchResult[] {
  const seen = new Set<string>();
  const output: WebSearchResult[] = [];

  for (const result of results) {
    const key = `${result.engine}:${result.url}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(result);
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function decodeBingRedirectTarget(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = decodeHtmlEntities(value).trim();
  if (!normalized) {
    return undefined;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const base64Candidate = normalized.startsWith("a1") ? normalized.slice(2) : normalized;
  try {
    const decoded = Buffer.from(base64Candidate, "base64").toString("utf8").trim();
    if (/^https?:\/\//i.test(decoded)) {
      return decoded;
    }
  } catch {
    return undefined;
  }

  return undefined;
}
