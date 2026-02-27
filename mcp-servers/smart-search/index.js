#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const KAGI_API_KEY = process.env.KAGI_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// ── Kagi FastGPT ──────────────────────────────────────────────────────────────
// Returns AI answer + references. We extract only the references (real web results).
async function searchKagiFastGPT(query) {
  const res = await fetch("https://kagi.com/api/v0/fastgpt", {
    method: "POST",
    headers: {
      "Authorization": `Bot ${KAGI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, web_search: true }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Kagi FastGPT ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data?.data?.references || []).map(r => ({
    title: r.title || "",
    url: r.url,
    snippet: r.snippet || "",
    source: "kagi_fastgpt",
  }));
}

// ── Kagi Teclis (Web Enrichment — indie/niche web) ────────────────────────────
async function searchKagiTeclis(query) {
  const res = await fetch(
    `https://kagi.com/api/v0/enrich/web?q=${encodeURIComponent(query)}`,
    {
      headers: { "Authorization": `Bot ${KAGI_API_KEY}` },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) throw new Error(`Kagi Teclis ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data?.data || []).map(r => ({
    title: r.title || "",
    url: r.url,
    snippet: r.snippet || "",
    source: "kagi_teclis",
    published: r.published || null,
  }));
}

// ── Kagi TinyGem (News Enrichment) ───────────────────────────────────────────
async function searchKagiTinyGem(query) {
  const res = await fetch(
    `https://kagi.com/api/v0/enrich/news?q=${encodeURIComponent(query)}`,
    {
      headers: { "Authorization": `Bot ${KAGI_API_KEY}` },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) throw new Error(`Kagi TinyGem ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data?.data || []).map(r => ({
    title: r.title || "",
    url: r.url,
    snippet: r.snippet || "",
    source: "kagi_tinygem",
    published: r.published || null,
  }));
}

// ── Tavily ────────────────────────────────────────────────────────────────────
async function searchTavily(query, maxResults = 10) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      max_results: maxResults,
      include_answer: false,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data?.results || []).map(r => ({
    title: r.title || "",
    url: r.url,
    snippet: r.content || "",
    source: "tavily",
    score: r.score,
  }));
}

// ── Dedup by URL ──────────────────────────────────────────────────────────────
function deduplicateByUrl(results) {
  const seen = new Set();
  return results.filter(r => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

// ── MCP Server ────────────────────────────────────────────────────────────────
const server = new McpServer({
  name: "smart-search",
  version: "1.0.0",
});

server.tool(
  "web_search",
  [
    "Search the web using multiple engines simultaneously:",
    "  • Kagi FastGPT   — high-quality curated web results",
    "  • Kagi Teclis    — indie/niche/non-mainstream web",
    "  • Kagi TinyGem  — news & recent articles",
    "  • Tavily         — broad mainstream web coverage",
    "All four are queried in parallel. Results are merged and deduplicated by URL.",
    "Use this tool for any web search query instead of the built-in search.",
  ].join("\n"),
  {
    query: z.string().describe("The search query"),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(10)
      .describe("Max results to return per source (default 10)"),
  },
  async ({ query, max_results = 10 }) => {
    const [fastgpt, teclis, tinygem, tavily] = await Promise.allSettled([
      searchKagiFastGPT(query),
      searchKagiTeclis(query),
      searchKagiTinyGem(query),
      searchTavily(query, max_results),
    ]);

    const results = deduplicateByUrl([
      ...(fastgpt.status === "fulfilled" ? fastgpt.value : []),
      ...(teclis.status === "fulfilled"  ? teclis.value  : []),
      ...(tinygem.status === "fulfilled" ? tinygem.value : []),
      ...(tavily.status === "fulfilled"  ? tavily.value  : []),
    ]);

    const stats = {
      kagi_fastgpt: fastgpt.status === "fulfilled"
        ? fastgpt.value.length
        : `ERR: ${fastgpt.reason?.message}`,
      kagi_teclis: teclis.status === "fulfilled"
        ? teclis.value.length
        : `ERR: ${teclis.reason?.message}`,
      kagi_tinygem: tinygem.status === "fulfilled"
        ? tinygem.value.length
        : `ERR: ${tinygem.reason?.message}`,
      tavily: tavily.status === "fulfilled"
        ? tavily.value.length
        : `ERR: ${tavily.reason?.message}`,
      total_unique: results.length,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ query, stats, results }, null, 2),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
