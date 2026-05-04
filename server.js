import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadKnowledgeBase } from "./src/knowledge.js";
import { retrieveKnowledge } from "./src/retriever.js";
import {
  createAiChatResponse,
  createAiReport,
  createSiliconFlowChatResponse,
  createSiliconFlowReport,
  testOpenAIConnection,
  testSiliconFlowConnection
} from "./src/ai.js";
import { createFallbackReport } from "./src/report.js";
import { createFallbackChatResponse } from "./src/chat.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const allowClientApiKeys = process.env.ALLOW_CLIENT_API_KEYS === "true";

if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const apiLimiter = createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 80)
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    provider: configuredProvider(),
    publicAiConfigured: Boolean(getServerApiConfig()),
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
    siliconFlowConfigured: Boolean(process.env.SILICONFLOW_API_KEY),
    allowClientApiKeys
  });
});

app.get("/api/knowledge/summary", async (_req, res, next) => {
  try {
    const knowledge = await loadKnowledgeBase();
    const summary = Object.fromEntries(
      Object.entries(knowledge).map(([key, items]) => [key, items.length])
    );
    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

app.post("/api/analyze", apiLimiter, async (req, res, next) => {
  try {
    const match = normalizeMatch(req.body);
    const apiConfig = getRequestApiConfig(req.body.apiConfig);
    const knowledge = await loadKnowledgeBase();
    const retrieved = retrieveKnowledge(match, knowledge);

    if (apiConfig?.provider === "siliconflow" && apiConfig.apiKey) {
      const report = await createSiliconFlowReport(match, retrieved, apiConfig);
      return res.json({ provider: "siliconflow", report, retrieved });
    }

    if (apiConfig?.provider === "openai" && process.env.OPENAI_API_KEY) {
      const report = await createAiReport(match, retrieved);
      return res.json({ provider: "openai", report, retrieved });
    }

    res.json({
      provider: "local-fallback",
      report: createFallbackReport(match, retrieved),
      retrieved
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat", apiLimiter, async (req, res, next) => {
  try {
    const messages = normalizeMessages(req.body.messages);
    const latest = messages.at(-1)?.content || "";
    const playerProfile = normalizePlayerProfile(req.body.playerProfile);
    const apiConfig = getRequestApiConfig(req.body.apiConfig);
    const knowledge = await loadKnowledgeBase();
    const retrieved = retrieveKnowledge(
      {
        level: playerProfile.level,
        rank: playerProfile.rank,
        playerNinja: playerProfile.playerNinja,
        enemyNinja: playerProfile.enemyNinja,
        result: "",
        selfDiagnosis: latest,
        keyMoments: [{ time: "对话", description: latest }]
      },
      knowledge
    );

    if (apiConfig?.provider === "siliconflow" && apiConfig.apiKey) {
      const reply = await createSiliconFlowChatResponse({
        messages,
        playerProfile,
        retrieved,
        apiConfig
      });
      return res.json({
        provider: "siliconflow",
        reply,
        evidence: toEvidence(retrieved),
        retrieved
      });
    }

    if (apiConfig?.provider === "openai" && process.env.OPENAI_API_KEY) {
      const reply = await createAiChatResponse({ messages, playerProfile, retrieved });
      return res.json({
        provider: "openai",
        reply,
        evidence: toEvidence(retrieved),
        retrieved
      });
    }

    const fallback = createFallbackChatResponse({ message: latest, playerProfile, retrieved });
    res.json({
      provider: "local-fallback",
      reply: fallback.reply,
      evidence: fallback.evidence,
      retrieved
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/test-provider", apiLimiter, async (req, res, next) => {
  try {
    const apiConfig = getRequestApiConfig(req.body.apiConfig);
    if (!apiConfig) {
      return res.status(400).json({
        error: "服务器还没有配置可用模型。站长需要设置 SILICONFLOW_API_KEY。"
      });
    }

    if (apiConfig.provider === "openai") {
      const reply = await testOpenAIConnection();
      return res.json({
        ok: true,
        provider: "openai",
        model: process.env.OPENAI_MODEL || "gpt-5.5",
        reply
      });
    }

    if (apiConfig.provider !== "siliconflow") {
      return res.status(400).json({
        error: "当前测试接口只支持站点模型或硅基流动。"
      });
    }

    const reply = await testSiliconFlowConnection(apiConfig);
    res.json({
      ok: true,
      provider: "siliconflow",
      model: apiConfig.model,
      reply
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: "请求处理失败",
    detail: error.message
  });
});

app.listen(port, () => {
  console.log(`Duel coach is running at http://localhost:${port}`);
});

function getRequestApiConfig(clientConfig) {
  const serverConfig = getServerApiConfig();
  if (serverConfig) return serverConfig;
  if (allowClientApiKeys) return normalizeApiConfig(clientConfig);
  return null;
}

function getServerApiConfig() {
  if (process.env.SILICONFLOW_API_KEY) {
    return {
      provider: "siliconflow",
      apiKey: normalizeApiKey(process.env.SILICONFLOW_API_KEY),
      model: normalizeSiliconFlowModel(process.env.SILICONFLOW_MODEL || "deepseek-ai/DeepSeek-V3.2"),
      baseUrl: clean(process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1")
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return { provider: "openai" };
  }

  return null;
}

function configuredProvider() {
  const config = getServerApiConfig();
  return config?.provider || "local-fallback";
}

function toEvidence(retrieved) {
  return retrieved.slice(0, 4).map((item) => ({
    title: item.title,
    id: item.id,
    sourceType: item.sourceType
  }));
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
      ? body.keyMoments.map((moment) => ({
          time: clean(moment.time),
          description: clean(moment.description)
        }))
      : []
  };
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: clean(message.content).slice(0, 2000)
    }))
    .filter((message) => message.content)
    .slice(-20);
}

function normalizePlayerProfile(profile = {}) {
  return {
    level: clean(profile.level || "intermediate"),
    rank: clean(profile.rank),
    playerNinja: clean(profile.playerNinja),
    enemyNinja: clean(profile.enemyNinja)
  };
}

function normalizeApiConfig(config = {}) {
  const provider = clean(config.provider);
  if (provider !== "siliconflow") {
    return null;
  }

  return {
    provider,
    apiKey: normalizeApiKey(config.apiKey),
    model: normalizeSiliconFlowModel(config.model || "deepseek-ai/DeepSeek-V3.2"),
    baseUrl: normalizeSiliconFlowBaseUrl(config.baseUrl || "https://api.siliconflow.cn/v1")
  };
}

function normalizeSiliconFlowBaseUrl(value) {
  const baseUrl = clean(value || "https://api.siliconflow.cn/v1").replace(/\/$/, "");
  const allowed = new Set(["https://api.siliconflow.cn/v1", "https://api.siliconflow.com/v1"]);
  if (!allowed.has(baseUrl)) {
    const error = new Error("接口地址只允许使用硅基流动官方 API。");
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

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(ip, bucket);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return res.status(429).json({
        error: "请求太频繁，请稍后再试。"
      });
    }

    next();
  };
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeApiKey(value) {
  return clean(value)
    .replace(/^bearer\s+/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function normalizeSiliconFlowModel(value) {
  const model = clean(value);
  const aliases = {
    "DeepSeek-V3.2": "deepseek-ai/DeepSeek-V3.2",
    "DeepSeek-V3.2-Exp": "deepseek-ai/DeepSeek-V3.2-Exp",
    "DeepSeek-V3.1": "deepseek-ai/DeepSeek-V3.1",
    "DeepSeek-V3": "deepseek-ai/DeepSeek-V3",
    "DeepSeek-R1": "deepseek-ai/DeepSeek-R1"
  };
  return aliases[model] || model || "deepseek-ai/DeepSeek-V3.2";
}
