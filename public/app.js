const form = document.querySelector("#review-form");
const submit = document.querySelector("#submit");
const reportContent = document.querySelector("#report-content");
const empty = document.querySelector("#empty");
const health = document.querySelector("#health");
const kbSummary = document.querySelector("#kb-summary");
const momentList = document.querySelector("#moment-list");
const addMoment = document.querySelector("#add-moment");
const demoButtons = document.querySelectorAll(".demo-btn");
const historyList = document.querySelector("#history-list");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const chatSubmit = document.querySelector("#chat-submit");
const chatMessages = document.querySelector("#chat-messages");
const chatEvidence = document.querySelector("#chat-evidence");
const chatSamples = document.querySelectorAll(".chat-sample");
const providerSelect = document.querySelector("#provider-select");
const siliconflowKey = document.querySelector("#siliconflow-key");
const siliconflowModel = document.querySelector("#siliconflow-model");
const siliconflowBaseUrl = document.querySelector("#siliconflow-base-url");
const saveProvider = document.querySelector("#save-provider");
const testProvider = document.querySelector("#test-provider");
const providerStatus = document.querySelector("#provider-status");
const providerBox = document.querySelector(".provider-box");

const labels = {
  mechanics: "机制",
  mistakes: "错误",
  trainings: "训练",
  ninjas: "忍者",
  matchups: "对局"
};

const demos = {
  skill: {
    level: "beginner",
    rank: "暗部到影级",
    result: "失败",
    playerNinja: "宇智波佐助",
    enemyNinja: "漩涡鸣人",
    selfDiagnosis: "开局技能空放以后我还往前压，被对手抓后摇反打。后面一技能空了还想用二技能补救，结果两个技能都没了。",
    keyMoments: [
      { time: "00:18", description: "技能空放后继续前压" },
      { time: "00:41", description: "一技能空后立刻交二技能" },
      { time: "01:03", description: "站在对手强势距离里犹豫" }
    ]
  },
  sub: {
    level: "intermediate",
    rank: "影级附近",
    result: "失败",
    playerNinja: "漩涡鸣人",
    enemyNinja: "宇智波佐助",
    selfDiagnosis: "我经常被轻微命中就交替身，替身后也没有打出反手。对手后面知道我没替身，就一直压我。",
    keyMoments: [
      { time: "00:22", description: "低收益命中后过早替身" },
      { time: "00:45", description: "对手替身后盲目追击" },
      { time: "01:10", description: "防守时连续乱交资源" }
    ]
  },
  ult: {
    level: "intermediate",
    rank: "影级以上",
    result: "胜利但不稳定",
    playerNinja: "宇智波鼬",
    enemyNinja: "旗木卡卡西",
    selfDiagnosis: "我有血量优势时太想收尾，奥义没有确认就直接放。对手替身还在，我的节奏被反打回来。",
    keyMoments: [
      { time: "00:56", description: "奥义没有命中确认" },
      { time: "01:14", description: "只为伤害放奥义" },
      { time: "01:31", description: "不会骗替身" }
    ]
  }
};

let publicAiConfigured = false;
let publicProvider = "local-fallback";
let allowClientApiKeys = false;
let chatHistory = [
  {
    role: "assistant",
    content:
      "我是你的决斗场教练。你可以直接问我某个局面怎么处理，也可以说一局输法，我会按知识库给你拆问题和布置下一局作业。"
  }
];

boot();
loadProviderConfig();
renderHistory();
renderChat();

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  chatHistory.push({ role: "user", content: message });
  chatInput.value = "";
  renderChat();
  await askCoach();
});

chatSamples.forEach((button) => {
  button.addEventListener("click", () => {
    chatInput.value = button.dataset.message;
    chatInput.focus();
  });
});

saveProvider.addEventListener("click", () => {
  if (!allowClientApiKeys) return;
  const config = collectApiConfig();
  localStorage.setItem("duelCoachApiConfig", JSON.stringify(config));
  providerStatus.textContent =
    config.provider === "siliconflow" && config.apiKey
      ? "硅基流动已保存，下一次提问会调用模型。"
      : "已保存为本地预览模式。";
  updateHealthText();
});

testProvider.addEventListener("click", async () => {
  const config = collectApiConfig();
  if (allowClientApiKeys && (config.provider !== "siliconflow" || !config.apiKey)) {
    providerStatus.textContent = "请先选择硅基流动，并填写 API key。";
    return;
  }

  testProvider.disabled = true;
  testProvider.textContent = "测试中";
  providerStatus.textContent = "正在连接硅基流动...";

  try {
    const response = await fetch("/api/test-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiConfig: allowClientApiKeys ? config : undefined })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || "连接失败");

    if (allowClientApiKeys) {
      localStorage.setItem("duelCoachApiConfig", JSON.stringify(config));
    }
    providerStatus.textContent = `连接成功：${data.model}`;
    updateHealthText();
  } catch (error) {
    providerStatus.textContent = `连接失败：${error.message}`;
  } finally {
    testProvider.disabled = false;
    testProvider.textContent = allowClientApiKeys ? "测试连接" : "测试站点模型";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submit.disabled = true;
  submit.textContent = "生成中";

  try {
    const payload = collectForm();
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, apiConfig: collectApiConfig() })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || "生成失败");

    renderReport(data.report, data.provider);
    saveHistory(data.report, payload, data.provider);
    renderHistory();
  } catch (error) {
    empty.hidden = true;
    reportContent.hidden = false;
    reportContent.innerHTML = `<div class="problem"><h3>生成失败</h3><p class="muted">${escapeHtml(error.message)}</p></div>`;
  } finally {
    submit.disabled = false;
    submit.textContent = "生成复盘";
  }
});

addMoment.addEventListener("click", () => {
  momentList.appendChild(createMomentRow("", ""));
});

demoButtons.forEach((button) => {
  button.addEventListener("click", () => {
    fillForm(demos[button.dataset.demo]);
  });
});

async function askCoach() {
  chatSubmit.disabled = true;
  chatSubmit.textContent = "思考中";
  const thinking = { role: "assistant", content: "我先看一下知识库里有没有能用的依据。" };
  chatHistory.push(thinking);
  renderChat();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: chatHistory.filter((message) => message !== thinking),
        playerProfile: collectPlayerProfile(),
        apiConfig: collectApiConfig()
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || "教练暂时没回答上来");

    thinking.content = data.reply;
    renderChatEvidence(data.evidence || []);
  } catch (error) {
    thinking.content = `这次回答失败：${error.message}`;
  } finally {
    chatSubmit.disabled = false;
    chatSubmit.textContent = "问教练";
    renderChat();
  }
}

async function boot() {
  try {
    const [healthResponse, summaryResponse] = await Promise.all([
      fetch("/api/health"),
      fetch("/api/knowledge/summary")
    ]);

    const healthData = await healthResponse.json();
    const summaryData = await summaryResponse.json();

    publicAiConfigured = Boolean(healthData.publicAiConfigured);
    publicProvider = healthData.provider || "local-fallback";
    allowClientApiKeys = Boolean(healthData.allowClientApiKeys);
    updateHealthText();
    updateProviderVisibility();
    renderKnowledgeSummary(summaryData.summary);
  } catch {
    health.textContent = "服务未连接";
  }
}

function loadProviderConfig() {
  try {
    const config = JSON.parse(localStorage.getItem("duelCoachApiConfig") || "{}");
    providerSelect.value = config.provider || "local";
    siliconflowKey.value = config.apiKey || "";
    siliconflowModel.value = config.model || "deepseek-ai/DeepSeek-V3.2";
    siliconflowBaseUrl.value = normalizeSiliconFlowBaseUrl(config.baseUrl);
    updateHealthText();
  } catch {
    providerSelect.value = "local";
  }
}

function collectApiConfig() {
  if (!allowClientApiKeys) {
    return { provider: "server" };
  }

  if (providerSelect.value !== "siliconflow") {
    return { provider: "local" };
  }

  return {
    provider: "siliconflow",
    apiKey: normalizeApiKey(siliconflowKey.value),
    model: normalizeSiliconFlowModel(siliconflowModel.value),
    baseUrl: siliconflowBaseUrl.value.trim() || "https://api.siliconflow.cn/v1"
  };
}

function updateHealthText() {
  if (!allowClientApiKeys) {
    if (publicProvider === "siliconflow") {
      health.textContent = "站点 AI 已启用";
      providerStatus.textContent = "站点正在使用服务器配置的硅基流动模型。普通用户无需填写 API key。";
      return;
    }
    if (publicProvider === "openai") {
      health.textContent = "站点 AI 已启用";
      providerStatus.textContent = "站点正在使用服务器配置的 OpenAI 模型。";
      return;
    }
    health.textContent = "本地预览模式";
    providerStatus.textContent = "站长还没有在服务器配置模型，当前使用本地预览回答。";
    return;
  }

  const config = collectApiConfig();
  if (config.provider === "siliconflow" && config.apiKey) {
    health.textContent = "硅基流动已配置";
    return;
  }

  health.textContent = publicAiConfigured ? "站点 AI 已启用" : "本地预览模式";
}

function updateProviderVisibility() {
  providerBox.classList.toggle("public-mode", !allowClientApiKeys);
  document.querySelectorAll(".client-provider-field").forEach((element) => {
    element.hidden = !allowClientApiKeys;
  });
  [providerSelect, siliconflowKey, siliconflowModel, siliconflowBaseUrl, saveProvider].forEach((element) => {
    element.disabled = !allowClientApiKeys;
  });
  testProvider.textContent = allowClientApiKeys ? "测试连接" : "测试站点模型";
}

function collectPlayerProfile() {
  return {
    level: document.querySelector("#profile-level").value,
    rank: document.querySelector("#profile-rank").value,
    playerNinja: document.querySelector("#profile-player").value,
    enemyNinja: document.querySelector("#profile-enemy").value
  };
}

function collectForm() {
  const data = new FormData(form);
  const rows = [...momentList.querySelectorAll(".moment-row")];

  return {
    level: data.get("level"),
    rank: data.get("rank"),
    result: data.get("result"),
    playerNinja: data.get("playerNinja"),
    enemyNinja: data.get("enemyNinja"),
    selfDiagnosis: data.get("selfDiagnosis"),
    keyMoments: rows
      .map((row) => ({
        time: row.querySelector('[name="time"]').value,
        description: row.querySelector('[name="description"]').value
      }))
      .filter((moment) => moment.time || moment.description)
  };
}

function fillForm(demo) {
  form.elements.level.value = demo.level;
  form.elements.rank.value = demo.rank;
  form.elements.result.value = demo.result;
  form.elements.playerNinja.value = demo.playerNinja;
  form.elements.enemyNinja.value = demo.enemyNinja;
  form.elements.selfDiagnosis.value = demo.selfDiagnosis;
  momentList.innerHTML = "";
  demo.keyMoments.forEach((moment) => {
    momentList.appendChild(createMomentRow(moment.time, moment.description));
  });
}

function createMomentRow(time, description) {
  const row = document.createElement("div");
  row.className = "moment-row";
  row.innerHTML = `
    <input name="time" placeholder="时间" aria-label="时间" value="${escapeAttribute(time)}" />
    <input name="description" placeholder="描述这个关键回合" aria-label="描述" value="${escapeAttribute(description)}" />
  `;
  return row;
}

function renderChat() {
  chatMessages.innerHTML = chatHistory
    .map((message) => `
      <article class="chat-message ${message.role}">
        <span>${message.role === "user" ? "你" : "教练"}</span>
        <p>${formatText(message.content)}</p>
      </article>
    `)
    .join("");
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderChatEvidence(evidence) {
  if (!evidence.length) {
    chatEvidence.innerHTML = `<strong>本轮依据</strong><span>知识库没有命中明确条目。</span>`;
    return;
  }

  chatEvidence.innerHTML = `
    <strong>本轮依据</strong>
    ${evidence
      .map((item) => `<span>${escapeHtml(item.sourceType)} · ${escapeHtml(item.title)}</span>`)
      .join("")}
  `;
}

function renderKnowledgeSummary(summary) {
  kbSummary.innerHTML = Object.entries(labels)
    .map(([key, label]) => {
      return `
        <div class="kb-card">
          <span>${label}</span>
          <strong>${summary[key] || 0}</strong>
        </div>
      `;
    })
    .join("");
}

function renderReport(report, provider) {
  empty.hidden = true;
  reportContent.hidden = false;

  reportContent.innerHTML = `
    <div class="report-block summary">
      <strong>${provider === "siliconflow" ? "硅基流动复盘" : provider === "openai" ? "AI 复盘" : "本地预览"}</strong>
      <p>${escapeHtml(report.summary || "")}</p>
    </div>

    <div class="report-block problem">
      <span class="tag">核心问题</span>
      <h3>${escapeHtml(report.mainProblem?.title || "未命名问题")}</h3>
      <p class="muted">${escapeHtml(report.mainProblem?.explanation || "")}</p>
    </div>

    <div class="report-block">
      <h3>关键失误</h3>
      <ul class="item-list">
        ${(report.keyMistakes || []).map(renderMistake).join("")}
      </ul>
    </div>

    <div class="report-block">
      <h3>推荐处理</h3>
      <ul class="item-list">
        ${(report.recommendations || []).map(renderRecommendation).join("")}
      </ul>
    </div>

    <div class="report-block">
      <h3>今日作业</h3>
      <p><strong>${escapeHtml(report.training?.title || "")}</strong></p>
      <p class="muted">${escapeHtml(report.training?.task || "")}</p>
      <p class="muted">通过标准：${escapeHtml(report.training?.successMetric || "")}</p>
    </div>

    <div class="report-block">
      <h3>下一局提醒</h3>
      <p class="muted">${escapeHtml(report.nextGameReminder || "")}</p>
    </div>

    <div class="report-block">
      <h3>知识依据</h3>
      <ul class="item-list">
        ${(report.evidence || []).map(renderEvidence).join("")}
      </ul>
    </div>
  `;
}

function renderMistake(item) {
  return `
    <li>
      <span class="tag">${escapeHtml(item.time || "关键点")}</span>
      <h3>${escapeHtml(item.title || "")}</h3>
      <p class="muted">${escapeHtml(item.why || "")}</p>
      <p class="muted">推荐：${escapeHtml(item.betterMove || "")}</p>
    </li>
  `;
}

function renderRecommendation(item) {
  return `
    <li>
      <span class="tag">${escapeHtml(item.confidence || "知识库")}</span>
      <h3>${escapeHtml(item.title || "")}</h3>
      <p class="muted">${escapeHtml(item.action || "")}</p>
    </li>
  `;
}

function renderEvidence(item) {
  return `
    <li>
      <span class="tag">${escapeHtml(item.sourceType || "")}</span>
      <strong>${escapeHtml(item.title || "")}</strong>
      <p class="muted">${escapeHtml(item.id || "")}</p>
    </li>
  `;
}

function saveHistory(report, payload, provider) {
  const history = loadHistory();
  history.unshift({
    id: crypto.randomUUID(),
    date: new Date().toLocaleString("zh-CN"),
    provider,
    playerNinja: payload.playerNinja || "未填写",
    enemyNinja: payload.enemyNinja || "未填写",
    problem: report.mainProblem?.title || "未命名问题",
    training: report.training?.title || "未生成作业",
    reminder: report.nextGameReminder || ""
  });
  localStorage.setItem("duelCoachHistory", JSON.stringify(history.slice(0, 6)));
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem("duelCoachHistory") || "[]");
  } catch {
    return [];
  }
}

function renderHistory() {
  const history = loadHistory();
  if (!history.length) {
    historyList.innerHTML = `<div class="empty compact">还没有复盘记录。先点一个示例，再生成复盘。</div>`;
    return;
  }

  historyList.innerHTML = history
    .map((item) => `
      <article class="history-card">
        <span>${escapeHtml(item.date)} · ${item.provider === "siliconflow" ? "硅基流动" : item.provider === "openai" ? "AI" : "本地"}</span>
        <h3>${escapeHtml(item.problem)}</h3>
        <p class="muted">${escapeHtml(item.playerNinja)} 对 ${escapeHtml(item.enemyNinja)}</p>
        <p class="muted">作业：${escapeHtml(item.training)}</p>
        <strong>${escapeHtml(item.reminder)}</strong>
      </article>
    `)
    .join("");
}

function formatText(value) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function normalizeApiKey(value) {
  return String(value || "")
    .trim()
    .replace(/^bearer\s+/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function normalizeSiliconFlowModel(value) {
  const model = String(value || "").trim();
  const aliases = {
    "DeepSeek-V3.2": "deepseek-ai/DeepSeek-V3.2",
    "DeepSeek-V3.2-Exp": "deepseek-ai/DeepSeek-V3.2-Exp",
    "DeepSeek-V3.1": "deepseek-ai/DeepSeek-V3.1",
    "DeepSeek-V3": "deepseek-ai/DeepSeek-V3",
    "DeepSeek-R1": "deepseek-ai/DeepSeek-R1"
  };
  return aliases[model] || model || "deepseek-ai/DeepSeek-V3.2";
}

function normalizeSiliconFlowBaseUrl(value) {
  const baseUrl = String(value || "").trim();
  if (!baseUrl || baseUrl === "https://api.siliconflow.com/v1") {
    return "https://api.siliconflow.cn/v1";
  }
  return baseUrl;
}
