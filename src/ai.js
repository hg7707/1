import OpenAI from "openai";
import { createFallbackReport } from "./report.js";

const KNOWLEDGE_VERSION = "2026-05 本地知识库";

export async function createAiReport(match, retrieved) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    instructions: buildReportInstructions(),
    input: JSON.stringify(buildReportInput(match, retrieved), null, 2),
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
    input: JSON.stringify(buildChatInput({ messages, playerProfile, retrieved }), null, 2),
    max_output_tokens: 1400
  });

  return response.output_text || "我现在没有生成有效回答。请补充你用的忍者、对面忍者、输在哪个回合，以及当时替身和技能是否可用。";
}

export async function createSiliconFlowChatResponse({ messages, playerProfile, retrieved, webSearch, apiConfig }) {
  const context = buildChatInput({ messages, playerProfile, retrieved, webSearch });
  if (shouldAnswerFromKnowledgeDirectly(context)) {
    return buildDirectKnowledgeReply(context);
  }

  if (shouldUseSafeFallback(context)) {
    return buildSafeFallbackReply(context);
  }

  const draft = await createSiliconFlowCompletion({
    apiConfig,
    messages: [
      { role: "system", content: buildCoachInstructions(context) },
      { role: "user", content: JSON.stringify(context, null, 2) }
    ],
    maxTokens: 1400,
    temperature: 0.15
  });

  if (!draft) {
    return "硅基流动返回了空内容。可以换个模型，或者检查 API key 和余额。";
  }

  const audit = await auditCoachAnswer({ apiConfig, answer: draft, context });
  if (audit.pass) return draft;

  const rewritten = await createSiliconFlowCompletion({
    apiConfig,
    messages: [
      { role: "system", content: buildCoachInstructions(context) },
      {
        role: "user",
        content: JSON.stringify(
          {
            ...context,
            rewriteBecauseAuditFailed: true,
            auditIssues: audit.issues,
            previousAnswer: draft
          },
          null,
          2
        )
      }
    ],
    maxTokens: 1400,
    temperature: 0.1
  });

  if (!rewritten) return buildSafeFallbackReply(context);

  const rewrittenAudit = await auditCoachAnswer({ apiConfig, answer: rewritten, context });
  return rewrittenAudit.pass ? rewritten : buildSafeFallbackReply(context, rewrittenAudit.issues);
}

export async function createSiliconFlowReport(match, retrieved, apiConfig) {
  const content = await createSiliconFlowCompletion({
    apiConfig,
    messages: [
      { role: "system", content: buildReportInstructions() },
      { role: "user", content: JSON.stringify(buildReportInput(match, retrieved), null, 2) }
    ],
    maxTokens: 1800,
    responseFormat: { type: "json_object" },
    temperature: 0.1
  });

  const parsed = parseJson(content || "");
  return parsed || createFallbackReport(match, retrieved);
}

export async function testSiliconFlowConnection(apiConfig) {
  const content = await createSiliconFlowCompletion({
    apiConfig,
    messages: [{ role: "user", content: "请只回复 OK，用于测试 API 连接。" }],
    maxTokens: 20,
    temperature: 0
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

async function createSiliconFlowCompletion({
  apiConfig,
  messages,
  maxTokens,
  responseFormat,
  temperature = 0.15
}) {
  const apiKey = apiConfig?.apiKey;
  if (!apiKey) throw new Error("缺少硅基流动 API key");

  const baseUrl = normalizeBaseUrl(apiConfig.baseUrl);
  const model = apiConfig.model || "deepseek-ai/DeepSeek-V3.2";
  const body = {
    model,
    messages: messages.slice(-10),
    stream: false,
    max_tokens: maxTokens,
    temperature,
    top_p: 0.75,
    ...(responseFormat ? { response_format: responseFormat } : {})
  };

  let response = await postChatCompletion(baseUrl, apiKey, body);
  if (response.status === 401 && baseUrl.includes("api.siliconflow.com")) {
    response = await postChatCompletion("https://api.siliconflow.cn/v1", apiKey, body);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createSiliconFlowError(response.status, data);
  }

  return data.choices?.[0]?.message?.content || "";
}

function postChatCompletion(baseUrl, apiKey, body) {
  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function auditCoachAnswer({ apiConfig, answer, context }) {
  const localAudit = auditCoachAnswerLocally(answer, context);
  if (!localAudit.pass) return localAudit;

  const content = await createSiliconFlowCompletion({
    apiConfig,
    messages: [
      {
        role: "system",
        content:
          "你是严格的事实审查器。只判断回答是否被输入的 retrievedKnowledge、webSearch.results、用户信息或通用决斗场原则支持。禁止补充新游戏知识。只输出 JSON。"
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            auditRules: [
              "如果回答编造具体忍者技能、帧数、版本强度、连招、秘卷或通灵效果，pass=false。",
              "如果把不确定内容说成确定事实，pass=false。",
              "如果没有足够信息却没有追问，pass=false。",
              "通用原则可以通过，但必须标记为通用建议。",
              "如果回答引用了不在 evidenceTitles 中的知识库标题或联网检索标题，pass=false。",
              "如果 coverage.hasStrongEvidence=false 且 coverage.hasWebEvidence=false 仍给具体忍者或 matchup 结论，pass=false。"
            ],
            evidenceTitles: getEvidenceTitles(context),
            context,
            answer
          },
          null,
          2
        )
      }
    ],
    maxTokens: 400,
    responseFormat: { type: "json_object" },
    temperature: 0
  });

  const parsed = parseJson(content || "");
  if (!parsed) return { pass: false, issues: ["审查器没有返回有效 JSON"] };
  return {
    pass: parsed.pass === true,
    issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 6) : []
  };
}

function buildChatInput({ messages, playerProfile, retrieved, webSearch = { query: "", results: [], error: "" } }) {
  const latestQuestion = messages.at(-1)?.content || "";
  const strongEvidence = retrieved.filter((item) => item.score >= 20).slice(0, 8);
  const supportEvidence = retrieved.filter((item) => item.score < 20).slice(0, 6);
  const missingFields = getMissingBattleFields(playerProfile);
  const webResults = Array.isArray(webSearch?.results) ? webSearch.results.slice(0, 4) : [];
  const evidenceTitles = [
    ...[...strongEvidence, ...supportEvidence].map((item) => item.title),
    ...webResults.map((item) => `联网检索：${item.title}`)
  ];

  return {
    task: "基于知识库做火影忍者手游决斗场教练回复",
    knowledgeVersion: KNOWLEDGE_VERSION,
    reliabilityPolicy: {
      allowed: [
        "引用 retrievedKnowledge 中明确出现的机制、错误模式、训练任务和 matchup",
        "给出不依赖具体忍者技能细节的通用决斗场原则",
        "在信息不足时追问一个最关键问题"
      ],
      forbidden: [
        "编造具体忍者技能效果、数值、帧数、霸体/无敌/抓取/扫地等机制",
        "编造当前版本强度、胜率、官方改动或未提供的 matchup 细节",
        "把推测写成确定事实",
        "承诺必赢、必克制、绝对最优",
        "引用 retrievedKnowledge 中不存在的知识库标题"
      ]
    },
    requiredOutputSections: ["【结论】", "【依据】", "【下一局怎么打】", "【不确定/需要补充】", "【训练作业】"],
    playerProfile,
    latestQuestion,
    recentMessages: messages.slice(-8),
    retrievedKnowledge: {
      strongEvidence,
      supportEvidence
    },
    webSearch: {
      enabled: Boolean(webSearch?.query),
      query: webSearch?.query || "",
      results: webResults,
      error: webSearch?.error || "",
      instruction:
        webResults.length > 0
          ? "Local knowledge was insufficient, so these web results may be used as secondary evidence. Cite them as 联网检索：title and avoid overclaiming."
          : "No web evidence is available."
    },
    coverage: {
      hasStrongEvidence: strongEvidence.length > 0,
      hasWebEvidence: webResults.length > 0,
      hasNinjaSpecificEvidence: strongEvidence.some((item) =>
        ["ninja_basics", "ninja_playstyles", "ninja_tips", "matchup_decisions"].includes(item.sourceType)
      ),
      missingFields,
      evidenceTitles,
      instruction:
        strongEvidence.length > 0
          ? "优先基于 strongEvidence 回答。"
          : "没有强证据时，只能给通用原则，并追问一个最关键问题。"
    }
  };
}

function buildReportInput(match, retrieved) {
  return {
    task: "基于知识库生成赛后复盘报告",
    knowledgeVersion: KNOWLEDGE_VERSION,
    match,
    retrievedKnowledge: retrieved,
    reliabilityPolicy: {
      forbidden: "禁止编造具体忍者技能、版本强度、数值和未命中的 matchup 细节。",
      fallback: "证据不足时写明当前知识库不足，只给通用复盘建议。"
    }
  };
}

function buildReportInstructions() {
  return `
你是《火影忍者手游》决斗场赛后复盘教练。
你必须严格根据用户提供的 match 和 retrievedKnowledge 输出报告。

硬性规则：
1. retrievedKnowledge 没有覆盖的具体忍者、技能、版本强度、连招或 matchup，必须写“当前知识库不足以判断”，不能编造。
2. 可以给通用决斗场原则，但必须表述为“通用建议”。
3. 不要承诺“必胜”“绝对最优”“一定克制”。
4. 输出必须是 JSON，不要 Markdown，不要额外解释。

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
      "confidence": "知识库命中/通用建议/信息不足"
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
      "sourceType": "ninja_basics/ninja_playstyles/ninja_tips/duel_logic/matchup_decisions/matchmaking/rank_recommendations",
      "id": "知识条目 id"
    }
  ]
}
`.trim();
}

function buildCoachInstructions(context = {}) {
  const webPolicy = context.coverage?.hasWebEvidence
    ? `

联网检索补充规则：
1. 本轮本地知识库强证据不足，但输入里提供了 webSearch.results。你可以把 webSearch.results 作为次级证据回答。
2. 使用网页结果时，必须在【依据】里写“联网检索：网页标题”，不要写成“知识库命中”。
3. 网页信息可能过期或不完整；对版本强度、伤害数值、冷却、帧数、削弱调整等内容必须标注“联网资料显示/需要复核”，不能写成绝对事实。
4. 如果网页结果和本地知识库冲突，以本地知识库优先；如果只有网页结果，回答要更保守。
5. 不要编造 webSearch.results 中没有出现的网页标题、链接或具体技能细节。
`
    : "";
  return `
你是一个专门教玩家打《火影忍者手游》决斗场的中文 AI 教练。
你的目标不是闲聊，而是像教练一样：判断问题、纠错、给下一局可执行训练。

最高优先级规则：
1. 只能把 retrievedKnowledge、webSearch.results、用户输入和通用决斗场原则作为依据。
2. 如果知识库没有覆盖具体忍者、技能、版本强度、连招、秘卷或通灵效果，必须说明“不确定/当前知识库没有依据”，不能编造。
3. 具体技能机制、霸体、无敌、抓取、扫地、帧数、数值、版本强度，只有在 retrievedKnowledge 或 webSearch.results 明确写出时才能说；仅来自网页时必须标注需要复核。
4. 用户信息不足时，先给一个通用初判，然后只追问 1 个最关键问题。
5. 禁止“必胜”“绝对克制”“无脑打”“最强”等过度确定表达。
6. 高风险结论要标明“基于你当前描述的判断”。
7. 【依据】里只能写输入中 evidenceTitles 存在的标题，或写“通用决斗场原则”。不能自己发明知识库或网页标题。
8. coverage.hasStrongEvidence=false 且 coverage.hasWebEvidence=false 时，不允许给具体忍者对局结论，只能给通用处理和追问。
9. 不要输出技能冷却时间、伤害比例、帧数、霸体/无敌/抓取/扫地效果，除非 retrievedKnowledge 原文明确提供。

回复格式：
【结论】
用 1-2 句说明最可能的问题。证据不足时要直接说证据不足。

【依据】
列 1-3 条依据。只能写“知识库命中：标题”“联网检索：标题”或“通用决斗场原则”，不要暴露 id。

【下一局怎么打】
给 2-4 条具体动作建议。每条都要可执行。

【不确定/需要补充】
如果信息不足，只问 1 个最关键问题；如果信息充分，可以写“暂无”。

【训练作业】
给一个 5 局以内能验证的训练任务。
${webPolicy}`.trim();
}

function shouldUseSafeFallback(context) {
  const latestQuestion = normalizeText(context.latestQuestion);
  if (!latestQuestion) return true;
  if (context.coverage?.hasWebEvidence) return false;
  const asksSpecificMechanic = /技能|机制|冷却|帧|伤害|连招|秘卷|通灵|霸体|无敌|抓取|扫地|版本|强度|克制|怎么打/.test(latestQuestion);
  return !context.coverage.hasStrongEvidence && asksSpecificMechanic;
}

function shouldAnswerFromKnowledgeDirectly(context) {
  const latestQuestion = normalizeText(context.latestQuestion);
  if (!latestQuestion || !context.coverage.hasNinjaSpecificEvidence) return false;
  return /机制介绍|玩法介绍|技能介绍|忍者介绍|基础介绍|怎么玩|连招|秘卷|通灵|强度|上分/.test(latestQuestion);
}

function buildDirectKnowledgeReply(context) {
  const evidence = [
    ...(context.retrievedKnowledge.strongEvidence || []),
    ...(context.retrievedKnowledge.supportEvidence || [])
  ].filter((item) =>
    ["ninja_basics", "ninja_playstyles", "ninja_tips", "rank_recommendations"].includes(item.sourceType)
  );
  const primary = evidence[0];
  const basics = evidence.filter((item) => item.sourceType === "ninja_basics").slice(0, 2);
  const playstyles = evidence.filter((item) => item.sourceType === "ninja_playstyles").slice(0, 1);
  const tips = evidence.filter((item) => item.sourceType === "ninja_tips").slice(0, 2);
  const rank = evidence.find((item) => item.sourceType === "rank_recommendations");
  const cited = [...basics, ...playstyles, ...tips, ...(rank ? [rank] : [])]
    .filter(Boolean)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.title === item.title) === index)
    .slice(0, 5);

  return [
    "【结论】",
    `知识库已经命中“${primary?.title || "相关忍者资料"}”，可以回答这类基础机制问题。下面只按知识库内容整理，不补编未命中的细节。`,
    "",
    "【依据】",
    ...cited.slice(0, 4).map((item) => `知识库命中：${item.title}`),
    "",
    "【机制介绍】",
    ...formatEvidenceLines([...basics, ...playstyles], 4),
    "",
    "【使用要点】",
    ...formatEvidenceLines(tips.length ? tips : playstyles, 3),
    "",
    "【下一局怎么打】",
    ...buildActionLines(cited),
    "",
    "【不确定/需要补充】",
    rank
      ? "强度和上分定位属于版本相关信息，后续版本更新后需要复核。"
      : "如果要判断具体对局，还需要补充对面忍者、双方替身状态和这一波发生的位置。",
    "",
    "【训练作业】",
    "接下来 5 局只练一个点：每次进攻前先确认自己是用普攻、技能还是苦无位移起手，并记录哪种方式最容易被反打。"
  ].join("\n");
}

function formatEvidenceLines(items, maxLines) {
  const lines = [];
  for (const item of items) {
    const chunks = splitSentences(item.content || item.summary || "");
    for (const chunk of chunks) {
      if (lines.length >= maxLines) return lines;
      lines.push(`${lines.length + 1}. ${chunk}`);
    }
  }
  return lines.length ? lines : ["1. 当前命中的知识条目内容较短，建议继续补充更细的普攻、技能和连招资料。"];
}

function buildActionLines(items) {
  const text = items.map((item) => `${item.title} ${item.content}`).join("\n");
  const actions = [];
  if (/3A|4A|印记|苦无/.test(text)) actions.push("1. 起手后优先确认印记和苦无位置，不要无脑打满普攻。");
  if (/替身/.test(text)) actions.push(`${actions.length + 1}. 对手替身还在时，先保留一个位移或技能资源，别一次性交完。`);
  if (/秘卷|通灵/.test(text)) actions.push(`${actions.length + 1}. 秘卷和通灵按控制、保命、补起手三个目的选择，不要只看伤害。`);
  if (!actions.length) actions.push("1. 先按知识库里的核心机制建立起手、追击、收尾三段流程。");
  return actions.slice(0, 3);
}

function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？；])|(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.length > 120 ? `${part.slice(0, 118)}...` : part))
    .slice(0, 8);
}

function auditCoachAnswerLocally(answer, context) {
  const issues = [];
  const text = String(answer || "");
  const requiredSections = context.requiredOutputSections || [];
  const evidenceTitles = getEvidenceTitles(context);
  const forbiddenPatterns = [
    /必胜|必定|稳赢|绝对克制|无脑打|最强|T0|版本答案/,
    /\d+\s*(帧|秒冷却|s冷却|%伤害|点伤害)/i,
    /霸体|无敌|抓取|扫地/
  ];

  for (const section of requiredSections) {
    if (!text.includes(section)) issues.push(`缺少固定栏目：${section}`);
  }

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text) && !isUncertaintyStatement(text, pattern) && !isSupportedByEvidence(pattern, context)) {
      issues.push(`出现未由知识库支持的高风险表述：${pattern}`);
    }
  }

  const citedTitles = [...text.matchAll(/知识库命中：([^。\n\r]+)/g)].map((match) => match[1].trim());
  const fabricatedCitations = citedTitles.filter((title) => !evidenceTitles.includes(title));
  if (fabricatedCitations.length) {
    issues.push(`引用了不存在的知识库标题：${fabricatedCitations.join("、")}`);
  }

  if (!context.coverage.hasStrongEvidence && !context.coverage.hasWebEvidence && /打.+建议|克制|对局|具体打法|技能机制/.test(text) && !text.includes("通用")) {
    issues.push("强证据不足时给出了具体对局结论");
  }

  if ((context.coverage.missingFields || []).length >= 2 && !text.includes("？") && !text.includes("?")) {
    issues.push("战况信息不足但没有追问");
  }

  return { pass: issues.length === 0, issues: issues.slice(0, 6) };
}

function isSupportedByEvidence(pattern, context) {
  const supportText = [
    context.latestQuestion,
    context.playerProfile?.playerSecret,
    context.playerProfile?.playerSummon,
    context.playerProfile?.battleSituation,
    ...(context.retrievedKnowledge.strongEvidence || []),
    ...(context.retrievedKnowledge.supportEvidence || []),
    ...(context.webSearch?.results || [])
  ]
    .map((item) =>
      typeof item === "string" ? item : `${item.title} ${item.content || item.snippet || ""} ${(item.tags || []).join(" ")} ${item.url || ""}`
    )
    .join("\n");

  return pattern.test(supportText);
}

function isUncertaintyStatement(text, pattern) {
  const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  return matches.every((match) => {
    const start = Math.max(0, match.index - 18);
    const end = Math.min(text.length, match.index + match[0].length + 18);
    const nearby = text.slice(start, end);
    return /不确定|没有依据|不能判断|不能硬编|知识库不足|未提供/.test(nearby);
  });
}

function getMissingBattleFields(playerProfile = {}) {
  const fields = [
    ["playerNinja", "我方忍者"],
    ["enemyNinja", "对方忍者"],
    ["playerSubstitution", "我方替身状态"],
    ["enemySubstitution", "对方替身状态"],
    ["battleSituation", "具体战况"]
  ];
  return fields.filter(([key]) => !String(playerProfile[key] || "").trim()).map(([, label]) => label);
}

function getEvidenceTitles(context) {
  return [
    ...(context.retrievedKnowledge?.strongEvidence || []),
    ...(context.retrievedKnowledge?.supportEvidence || []),
    ...(context.webSearch?.results || []).map((item) => ({ title: `联网检索：${item.title}` }))
  ].map((item) => item.title);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function buildSafeFallbackReply(context) {
  const question = context.latestQuestion || "这个问题";
  const missing = context.coverage.missingFields || [];
  const evidence = [
    ...(context.retrievedKnowledge.strongEvidence || []),
    ...(context.retrievedKnowledge.supportEvidence || [])
  ].slice(0, 3);
  const evidenceLines = evidence.length
    ? evidence.map((item) => `知识库命中：${item.title}`)
    : ["通用决斗场原则：信息不足时先保资源、确认收益，不硬编具体机制。"];
  const questionToAsk = missing.length ? `请先补充：${missing[0]}。` : "请补充这一波开始前双方替身和关键技能是否可用？";

  return [
    "【结论】",
    `关于“${question}”，当前知识库和你的描述还不足以支持具体忍者机制判断，所以我不能硬编技能细节。先按通用决斗场原则处理：别在资源不足时继续前压，把目标改成重置距离和确认收益。`,
    "",
    "【依据】",
    ...evidenceLines,
    "",
    "【下一局怎么打】",
    "1. 关键技能没命中时，第一反应先后撤或横向走位，不马上补第二个关键资源。",
    "2. 交替身前先问自己：这次能逃生、反打，还是只是紧张？只有前两种才优先交。",
    "3. 有奥义时先确认命中或对手替身不可用，不把奥义当普通起手技能。",
    "",
    "【不确定/需要补充】",
    questionToAsk,
    "",
    "【训练作业】",
    "接下来 5 局只记录一次：关键技能空掉后，你有没有立刻撤出危险距离。"
  ].join("\n");
}

function normalizeBaseUrl(baseUrl) {
  return (baseUrl || "https://api.siliconflow.cn/v1").replace(/\/$/, "");
}

function createSiliconFlowError(status, data) {
  const raw = data.message || data.error?.message || data.error || "";
  if (status === 401) {
    return new Error(
      `硅基流动认证失败：401。请确认 API key 没有被删除或停用；如果你是在 cloud.siliconflow.cn 创建的 key，接口地址请优先使用 https://api.siliconflow.cn/v1。${raw ? `原始信息：${raw}` : ""}`
    );
  }

  if (status === 400 || status === 404) {
    return new Error(
      `硅基流动请求失败：${status}。请检查模型名是否完整，例如 deepseek-ai/DeepSeek-V3.2。${raw ? `原始信息：${raw}` : ""}`
    );
  }

  return new Error(raw || `硅基流动请求失败：${status}`);
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
