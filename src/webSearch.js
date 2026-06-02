const DEFAULT_TIMEOUT_MS = 8000;
const MAX_QUERY_LENGTH = 120;

export function shouldSearchWeb({ latestQuestion = "", retrieved = [], webSearchEnabled = true }) {
  if (!webSearchEnabled) return false;
  const question = clean(latestQuestion);
  if (question.length < 3) return false;
  const hasStrongEvidence = retrieved.some((item) => Number(item.score || 0) >= 20);
  if (hasStrongEvidence) return false;
  return /机制|技能|连招|打法|强度|版本|削弱|调整|秘卷|通灵|奥义|普攻|怎么|介绍|推荐|克制|上分/.test(question);
}

export async function searchWebForCoach({ latestQuestion = "", playerProfile = {}, maxResults = 4 } = {}) {
  const query = buildSearchQuery(latestQuestion, playerProfile);
  if (!query) return { query: "", results: [], error: "" };

  try {
    const html = await fetchBingHtml(query);
    return {
      query,
      results: parseBingResults(html).slice(0, maxResults),
      error: ""
    };
  } catch (error) {
    return {
      query,
      results: [],
      error: error?.message || "web search failed"
    };
  }
}

function buildSearchQuery(latestQuestion, playerProfile) {
  const parts = [
    "火影忍者手游 决斗场",
    playerProfile.playerNinja,
    playerProfile.enemyNinja,
    latestQuestion
  ]
    .map(clean)
    .filter(Boolean)
    .join(" ");
  return parts.slice(0, MAX_QUERY_LENGTH);
}

async function fetchBingHtml(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-CN&cc=CN`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7"
      }
    });
    if (!response.ok) throw new Error(`search returned HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    const fallbackUrl = `https://r.jina.ai/http://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(fallbackUrl, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      headers: { Accept: "text/plain,*/*;q=0.8" }
    });
    if (!response.ok) throw error;
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseBingResults(html) {
  const text = String(html || "");
  const results = text.includes("<html")
    ? parseHtmlResults(text)
    : parseMarkdownResults(text);
  return results
    .filter((item) => item.title && item.url)
    .filter((item, index, items) => items.findIndex((other) => other.url === item.url) === index);
}

function parseHtmlResults(html) {
  return [...html.matchAll(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/gi)].map(
    (match) => {
      const tail = html.slice(match.index, match.index + 1800);
      const snippetMatch =
        tail.match(/<p[^>]*>([\s\S]*?)<\/p>/i) ||
        tail.match(/<div[^>]*class="[^"]*\bb_caption\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      return {
        title: cleanHtml(match[2] || ""),
        url: normalizeBingUrl(decodeHtml(match[1] || "")),
        snippet: cleanHtml(snippetMatch?.[1] || "")
      };
    }
  );
}

function parseMarkdownResults(markdown) {
  return [...String(markdown || "").matchAll(/^## \[([^\]]+)\]\(([^)]+)\)([\s\S]*?)(?=^## \[|\z)/gm)].map((match) => ({
    title: clean(match[1]).slice(0, 120),
    url: normalizeDuckDuckGoUrl(match[2]),
    snippet: clean(
      match[3]
        .split("\n")
        .filter((line) => line && !line.startsWith("[!") && !line.startsWith("http"))
        .slice(0, 3)
        .join(" ")
    ).slice(0, 260)
  }));
}

function normalizeBingUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("bing.com") && parsed.pathname === "/ck/a") {
      const target = parsed.searchParams.get("u");
      if (target) return decodeBingTarget(target);
    }
  } catch {
    return url;
  }
  return url;
}

function normalizeDuckDuckGoUrl(url) {
  try {
    const parsed = new URL(url);
    const target = parsed.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : url;
  } catch {
    return url;
  }
}

function decodeBingTarget(value) {
  try {
    const raw = value.startsWith("a1") ? value.slice(2) : value;
    return Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return value;
  }
}

function cleanHtml(value) {
  return clean(decodeHtml(String(value || "").replace(/<[^>]+>/g, " "))).slice(0, 260);
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
