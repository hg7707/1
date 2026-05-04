import OpenAI from "openai";
import { createFallbackReport } from "./report.js";

export async function createAiReport(match, retrieved) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    instructions: buildReportInstructions(),
    input: JSON.stringify({ match, retrievedKnowledge: retrieved }, null, 2),
    max_output_tokens: 1800
  });

  const text = response.output_text || "";
  const parsed = parseJson(text);
  return parsed || createFallbackReport(match, retrieved);
}

export async function createAiChatResponse({ messages, playerProfile, retrieved }) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    instructions: buildCoachInstructions(),
    input: JSON.stringify(
      {
        playerProfile,
        recentMessages: messages.slice(-10),
        retrievedKnowledge: retrieved
      },
      null,
      2
    ),
    max_output_tokens: 1400
  });

  return response.output_text || "我这边没有生成出有效回答。你可以把问题说得更具体一点，比如：我什么时候该交替身？";
}

export async function createSiliconFlowChatResponse({ messages, playerProfile, retrieved, apiConfig }) {
  const content = await createSiliconFlowCompletion({
    apiConfig,
    messages: [
      { role: "system", content: buildCoachInstructions() },
      {
        role: "user",
        content: JSON.stringify(
          {
            playerProfile,
            recentMessages: messages.slice(-8),
            retrievedKnowledge: retrieved
          },
          null,
          2
        )
      }
    ],
    maxTokens: 1400
  });

  return content || "硅基流动返回了空内容。可以换个模型，或者检查 API key 和余额。";
}

export async function createSiliconFlowReport(match, retrieved, apiConfig) {
  const content = await createSiliconFlowCompletion({
    apiConfig,
    messages: [
      { role: "system", content: buildReportInstructions() },
      {
        role: "user",
        content: JSON.stringify({ match, retrievedKnowledge: retrieved }, null, 2)
      }
    ],
    maxTokens: 1800,
    responseFormat: { type: "json_object" }
  });

  const parsed = parseJson(content || "");
  return parsed || createFallbackReport(match, retrieved);
}

export async function testSiliconFlowConnection(apiConfig) {
  const content = await createSiliconFlowCompletion({
    apiConfig,
    messages: [{ role: "user", content: "请只回复 OK，用于测试 API 连接。" }],
    maxTokens: 20
  });

  return content;
}

export async function testOpenAIConnection() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    input: "请只回复 OK，用于测试 API 连接。",
    max_output_tokens: 20
  });

  return response.output_text || "";
}

async function createSiliconFlowCompletion({ apiConfig, messages, maxTokens, responseFormat }) {
  const apiKey = apiConfig?.apiKey;
  if (!apiKey) throw new Error("缺少硅基流动 API key");

  const baseUrl = normalizeBaseUrl(apiConfig.baseUrl);
  const model = apiConfig.model || "deepseek-ai/DeepSeek-V3.2";
  const body = {
    model,
    messages: messages.slice(-10),
    stream: false,
    max_tokens: maxTokens,
    temperature: 0.3,
    ...(responseFormat ? { response_format: responseFormat } : {})
  };
  let response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (response.status === 401 && baseUrl.includes("api.siliconflow.com")) {
    response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createSiliconFlowError(response.status, data);
  }

  return data.choices?.[0]?.message?.content || "";
}

function normalizeBaseUrl(baseUrl) {
  return (baseUrl || "https://api.siliconflow.cn/v1").replace(/\/$/, "");
}

function createSiliconFlowError(status, data) {
  const raw = data.message || data.error?.message || data.error || "";
  if (status === 401) {
    return new Error(
      `硅基流动认证失败：401。请确认 API key 没有被删除或停用；如果你是在 cloud.siliconflow.cn 创建的 key，接口地址请优先用 https://api.siliconflow.cn/v1。${raw ? `原始信息：${raw}` : ""}`
    );
  }

  if (status === 400 || status === 404) {
    return new Error(
      `硅基流动请求失败：${status}。请检查模型名是否完整，例如 deepseek-ai/DeepSeek-V3.2。${raw ? `原始信息：${raw}` : ""}`
    );
  }

  return new Error(raw || `硅基流动请求失败：${status}`);
}

function buildReportInstructions() {
  return `
你是火影忍者手游决斗场的赛后复盘教练。
你必须严格根据输入的 match 和 retrievedKnowledge 回答。
如果知识库没有覆盖某个忍者、机制或 matchup，你必须说“当前知识库不足以判断”，不能编造。
不要承诺必胜，不要使用“绝对最优”。只能说“推荐处理”“更稳的处理”。
输出必须是 JSON，不要 Markdown，不要额外解释。

JSON 结构：
{
  "summary": "一句话结论",
  "mainProblem": {
    "title": "核心问题",
    "explanation": "为什么这是本局优先问题"
  },
  "keyMistakes": [
    {
      "time": "时间点或关键点",
      "title": "失误名称",
      "why": "为什么有问题",
      "betterMove": "推荐处理"
    }
  ],
  "recommendations": [
    {
      "title": "建议标题",
      "action": "下一局具体怎么做",
      "confidence": "知识库命中/信息不足"
    }
  ],
  "training": {
    "title": "今日训练作业",
    "task": "具体练习",
    "successMetric": "通过标准"
  },
  "nextGameReminder": "下一局开打前看的短提醒",
  "evidence": [
    {
      "title": "知识条目标题",
      "sourceType": "mechanics/mistakes/trainings/ninjas/matchups",
      "id": "知识条目 id"
    }
  ]
}
`.trim();
}

function buildCoachInstructions() {
  return `
你是一个专门教玩家打《火影忍者手游》决斗场的中文教练智能体。
你的目标不是闲聊，而是像教练一样通过提问、判断、纠错、布置训练，帮助玩家提高决斗场水平。

回答规则：
1. 必须优先依据 retrievedKnowledge。知识库没有覆盖的具体忍者或 matchup，不要编造细节。
2. 可以给通用决斗场原则，但要说明这是通用建议。
3. 不要说“绝对最优”“必胜”。使用“更稳”“优先”“推荐处理”。
4. 每次回答尽量具体到下一局能执行的动作。
5. 如果用户问题太模糊，先给一个初步判断，再问 1 个最关键的追问。
6. 用户水平低时讲简单动作；水平高时讲资源、节奏、matchup 和心理博弈。
7. 语气像认真但不端着的教练，直接、清楚、能落地。

回答格式：
- 先给结论。
- 再给 2 到 4 条具体建议。
- 最后给一个“下一局作业”。
- 如果用到了知识库，简短写“依据：条目标题1、条目标题2”。
`.trim();
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
