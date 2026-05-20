const health = document.querySelector("#health");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const chatSubmit = document.querySelector("#chat-submit");
const chatMessages = document.querySelector("#chat-messages");
const chatSamples = document.querySelectorAll(".chat-sample");
const siliconflowKey = document.querySelector("#siliconflow-key");
const siliconflowModel = document.querySelector("#siliconflow-model");
const siliconflowBaseUrl = document.querySelector("#siliconflow-base-url");
const saveProvider = document.querySelector("#save-provider");
const testProvider = document.querySelector("#test-provider");
const providerStatus = document.querySelector("#provider-status");

let chatHistory = [
  {
    role: "assistant",
    content:
      "我是你的决斗场教练。请先在左侧填写硅基流动 API key，然后直接描述你这一局的问题。"
  }
];

boot();
loadProviderConfig();
renderChat();

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  if (!hasApiKey()) {
    providerStatus.textContent = "请先填写硅基流动 API key，保存或测试后再开始对话。";
    siliconflowKey.focus();
    return;
  }

  chatHistory.push({ role: "user", content: message });
  chatInput.value = "";
  resizeComposer();
  renderChat();
  await askCoach();
});

chatInput.addEventListener("input", resizeComposer);

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

chatSamples.forEach((button) => {
  button.addEventListener("click", () => {
    chatInput.value = button.dataset.message;
    resizeComposer();
    chatInput.focus();
  });
});

saveProvider.addEventListener("click", () => {
  if (!hasApiKey()) {
    providerStatus.textContent = "请先填写硅基流动 API key。";
    siliconflowKey.focus();
    return;
  }
  const config = collectApiConfig();
  localStorage.setItem("duelCoachApiConfig", JSON.stringify(config));
  providerStatus.textContent = "已保存，下一次提问会调用硅基流动模型。";
  updateHealthText();
});

testProvider.addEventListener("click", async () => {
  const config = collectApiConfig();
  if (!config.apiKey) {
    providerStatus.textContent = "请先填写硅基流动 API key。";
    siliconflowKey.focus();
    return;
  }

  testProvider.disabled = true;
  testProvider.textContent = "测试中";
  providerStatus.textContent = "正在连接模型...";

  try {
    const response = await fetch("/api/test-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiConfig: config })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || "连接失败");

    localStorage.setItem("duelCoachApiConfig", JSON.stringify(config));
    providerStatus.textContent = `连接成功：${data.model}`;
    updateHealthText();
  } catch (error) {
    providerStatus.textContent = `连接失败：${error.message}`;
  } finally {
    testProvider.disabled = false;
    testProvider.textContent = "测试";
  }
});

async function askCoach() {
  chatSubmit.disabled = true;
  chatSubmit.textContent = "思考中";
  const thinking = { role: "assistant", content: "我在分析你描述的局面。" };
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
  } catch (error) {
    thinking.content = `这次回答失败：${error.message}`;
  } finally {
    chatSubmit.disabled = false;
    chatSubmit.textContent = "发送";
    renderChat();
  }
}

async function boot() {
  try {
    const response = await fetch("/api/health");
    await response.json();
    updateHealthText();
  } catch {
    health.textContent = "服务未连接";
  }
}

function loadProviderConfig() {
  try {
    const config = JSON.parse(localStorage.getItem("duelCoachApiConfig") || "{}");
    siliconflowKey.value = config.apiKey || "";
    siliconflowModel.value = config.model || "deepseek-ai/DeepSeek-V3.2";
    siliconflowBaseUrl.value = normalizeSiliconFlowBaseUrl(config.baseUrl);
    updateHealthText();
  } catch {
    siliconflowModel.value = "deepseek-ai/DeepSeek-V3.2";
    siliconflowBaseUrl.value = "https://api.siliconflow.cn/v1";
    updateHealthText();
  }
}

function collectApiConfig() {
  return {
    provider: "siliconflow",
    apiKey: normalizeApiKey(siliconflowKey.value),
    model: normalizeSiliconFlowModel(siliconflowModel.value),
    baseUrl: siliconflowBaseUrl.value.trim() || "https://api.siliconflow.cn/v1"
  };
}

function updateHealthText() {
  const config = collectApiConfig();
  if (config.apiKey) {
    health.textContent = "API 已配置";
    providerStatus.textContent = "会使用当前浏览器保存的 API key。";
    return;
  }

  health.textContent = "需要 API key";
  providerStatus.textContent = "必须填写硅基流动 API key 后才可以使用教练。";
}

function hasApiKey() {
  return Boolean(normalizeApiKey(siliconflowKey.value));
}

function collectPlayerProfile() {
  return {
    level: document.querySelector("#profile-level").value,
    rank: document.querySelector("#profile-rank").value,
    playerNinja: document.querySelector("#profile-player").value,
    enemyNinja: document.querySelector("#profile-enemy").value
  };
}

function renderChat() {
  chatMessages.innerHTML = chatHistory
    .map((message) => {
      const label = message.role === "user" ? "你" : "教练";
      return `
        <article class="chat-message ${message.role}">
          <div class="avatar">${label.slice(0, 1)}</div>
          <div class="message-body">
            <strong>${label}</strong>
            <p>${formatText(message.content)}</p>
          </div>
        </article>
      `;
    })
    .join("");
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function resizeComposer() {
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 180)}px`;
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

function normalizeApiKey(value) {
  return String(value || "")
    .trim()
    .replace(/^bearer\s+/i, "")
    .replace(/^(["'])|(["'])$/g, "")
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
