import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadKnowledgeBase } from "./src/knowledge.js";
import { retrieveKnowledge } from "./src/retriever.js";
import { createSiliconFlowChatResponse, createSiliconFlowReport, testSiliconFlowConnection } from "./src/ai.js";
import { searchWebForCoach, shouldSearchWeb } from "./src/webSearch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const allowClientApiKeys = process.env.ALLOW_CLIENT_API_KEYS !== "false";

if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const apiLimiter = createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 80)
});

app.get("/api/health", (_req, res) => {
  const serverConfig = getServerApiConfig();
  res.json({
    ok: true,
    provider: configuredProvider(),
    publicAiConfigured: Boolean(serverConfig),
    siliconFlowConfigured: Boolean(process.env.SILICONFLOW_API_KEY),
    allowClientApiKeys: shouldAcceptClientApiKeys(),
    configuredAllowClientApiKeys: allowClientApiKeys
  });
});

app.get("/api/knowledge/summary", async (_req, res, next) => {
  try {
    const knowledge = await loadKnowledgeBase();
    res.json({ summary: Object.fromEntries(Object.entries(knowledge).map(([key, items]) => [key, items.length])) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/analyze", apiLimiter, async (req, res, next) => {
  try {
    const match = normalizeMatch(req.body);
    const apiConfig = requireSiliconFlowApiConfig(getRequestApiConfig(req.body.apiConfig));
    const retrieved = retrieveKnowledge(match, await loadKnowledgeBase());
    const report = await createSiliconFlowReport(match, retrieved, apiConfig);
    res.json({ provider: "siliconflow", report, retrieved, evidence: toEvidence(retrieved) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat", apiLimiter, async (req, res, next) => {
  try {
    const messages = normalizeMessages(req.body.messages);
    const latest = messages.at(-1)?.content || "";
    const playerProfile = normalizePlayerProfile(req.body.playerProfile);
    const apiConfig = requireSiliconFlowApiConfig(getRequestApiConfig(req.body.apiConfig));
    const retrieved = retrieveKnowledge(
      {
        level: playerProfile.level,
        rank: playerProfile.rank,
        playerNinja: playerProfile.playerNinja,
        enemyNinja: playerProfile.enemyNinja,
        playerSubstitution: playerProfile.playerSubstitution,
        enemySubstitution: playerProfile.enemySubstitution,
        playerSecret: playerProfile.playerSecret,
        playerSummon: playerProfile.playerSummon,
        battleSituation: playerProfile.battleSituation,
        result: "",
        selfDiagnosis: [
          messages.filter((m) => m.role === "user").slice(-4).map((m) => m.content).join(" "),
          playerProfile.playerSubstitution,
          playerProfile.enemySubstitution,
          playerProfile.playerSecret,
          playerProfile.playerSummon,
          playerProfile.battleSituation,
          latest
        ].join(" ").trim(),
        keyMoments: [{ time: "chat", description: latest }]
      },
      await loadKnowledgeBase()
    );
    const webSearch = shouldSearchWeb({
      latestQuestion: latest,
      retrieved,
      webSearchEnabled: process.env.WEB_SEARCH_ENABLED !== "false"
    })
      ? await searchWebForCoach({ latestQuestion: latest, playerProfile })
      : { query: "", results: [], error: "" };
    const reply = await createSiliconFlowChatResponse({ messages, playerProfile, retrieved, webSearch, apiConfig });
    res.json({ provider: "siliconflow", reply, evidence: toEvidence(retrieved), webSearch, retrieved });
  } catch (error) {
    next(error);
  }
});

app.post("/api/test-provider", apiLimiter, async (req, res, next) => {
  try {
    const apiConfig = requireSiliconFlowApiConfig(getRequestApiConfig(req.body.apiConfig));
    const reply = await testSiliconFlowConnection(apiConfig);
    res.json({ ok: true, provider: "siliconflow", model: apiConfig.model, reply });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: "Request failed", detail: error.message });
});

app.listen(port, () => console.log(`Duel coach is running at http://localhost:${port}`));

function getRequestApiConfig(clientConfig) {
  return getServerApiConfig() || (shouldAcceptClientApiKeys() ? normalizeApiConfig(clientConfig) : null);
}

function shouldAcceptClientApiKeys() {
  return allowClientApiKeys || !process.env.SILICONFLOW_API_KEY;
}

function getServerApiConfig() {
  if (!process.env.SILICONFLOW_API_KEY) return null;
  return {
    provider: "siliconflow",
    apiKey: normalizeApiKey(process.env.SILICONFLOW_API_KEY),
    model: normalizeSiliconFlowModel(process.env.SILICONFLOW_MODEL || "deepseek-ai/DeepSeek-V3.2"),
    baseUrl: clean(process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1")
  };
}

function configuredProvider() {
  return getServerApiConfig()?.provider || (shouldAcceptClientApiKeys() ? "client-siliconflow-key" : "requires-siliconflow-key");
}

function requireSiliconFlowApiConfig(apiConfig) {
  if (apiConfig?.provider === "siliconflow" && apiConfig.apiKey) return apiConfig;
  const error = new Error("Please enter a SiliconFlow API key first.");
  error.status = 400;
  throw error;
}

function toEvidence(retrieved) {
  return retrieved.slice(0, 4).map(({ title, id, sourceType, score }) => ({ title, id, sourceType, score }));
}

function normalizeMatch(body) {
  return {
    rank: clean(body.rank),
    level: clean(body.level || "intermediate"),
    playerNinja: clean(body.playerNinja),
    enemyNinja: clean(body.enemyNinja),
    result: clean(body.result),
    selfDiagnosis: clean(body.selfDiagnosis),
    keyMoments: Array.isArray(body.keyMoments)
      ? body.keyMoments.map((moment) => ({ time: clean(moment.time), description: clean(moment.description) }))
      : []
  };
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: clean(message.content).slice(0, 2000) }))
    .filter((message) => message.content)
    .slice(-20);
}

function normalizePlayerProfile(profile = {}) {
  return {
    level: clean(profile.level || "intermediate"),
    rank: clean(profile.rank),
    playerNinja: clean(profile.playerNinja),
    enemyNinja: clean(profile.enemyNinja),
    playerSubstitution: clean(profile.playerSubstitution),
    enemySubstitution: clean(profile.enemySubstitution),
    playerSecret: clean(profile.playerSecret).slice(0, 40),
    playerSummon: clean(profile.playerSummon).slice(0, 40),
    battleSituation: clean(profile.battleSituation).slice(0, 300)
  };
}

function normalizeApiConfig(config = {}) {
  if (clean(config.provider) !== "siliconflow") return null;
  return {
    provider: "siliconflow",
    apiKey: normalizeApiKey(config.apiKey),
    model: normalizeSiliconFlowModel(config.model || "deepseek-ai/DeepSeek-V3.2"),
    baseUrl: normalizeSiliconFlowBaseUrl(config.baseUrl || "https://api.siliconflow.cn/v1")
  };
}

function normalizeSiliconFlowBaseUrl(value) {
  const baseUrl = clean(value || "https://api.siliconflow.cn/v1").replace(/\/$/, "");
  if (!new Set(["https://api.siliconflow.cn/v1", "https://api.siliconflow.com/v1"]).has(baseUrl)) {
    const error = new Error("Only official SiliconFlow API base URLs are allowed.");
    error.status = 400;
    throw error;
  }
  return baseUrl;
}

function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const bucket = buckets.get(ip) || { count: 0, resetAt: now + windowMs };
    if (now > bucket.resetAt) Object.assign(bucket, { count: 0, resetAt: now + windowMs });
    bucket.count += 1;
    buckets.set(ip, bucket);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) return res.status(429).json({ error: "Too many requests. Please try again later." });
    next();
  };
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeApiKey(value) {
  return clean(value).replace(/^bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();
}

function normalizeSiliconFlowModel(value) {
  const aliases = {
    "DeepSeek-V3.2": "deepseek-ai/DeepSeek-V3.2",
    "DeepSeek-V3.2-Exp": "deepseek-ai/DeepSeek-V3.2-Exp",
    "DeepSeek-V3.1": "deepseek-ai/DeepSeek-V3.1",
    "DeepSeek-V3": "deepseek-ai/DeepSeek-V3",
    "DeepSeek-R1": "deepseek-ai/DeepSeek-R1"
  };
  const model = clean(value);
  return aliases[model] || model || "deepseek-ai/DeepSeek-V3.2";
}
