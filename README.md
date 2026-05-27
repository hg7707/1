# 决斗场 AI 教练智能体

这是一个面向《火影忍者手游》决斗场训练的 AI 教练网站。用户打开网站后，需要在网页里填写自己的硅基流动 API key，才能和教练对话。

## 当前结构

- 前端：`public`
- 后端：`server.js`
- AI 调用与审查：`src/ai.js`
- 知识库检索：`src/retriever.js`
- 兜底教练：`src/chat.js`
- 复盘报告：`src/report.js`
- 本地知识库：`knowledge`
- 可靠性检查：`scripts/reliability-check.js`

## 本地启动

```powershell
npm install
npm start
```

打开：

```text
http://localhost:3000
```

## 用户自填 API key 模式

本项目固定使用用户自填 API key 模式。站长不在服务器上配置自己的硅基流动 key，避免消耗站长额度。

推荐环境变量：

```text
ALLOW_CLIENT_API_KEYS=true
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3.2
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX=80
TRUST_PROXY=true
```

不要设置 `SILICONFLOW_API_KEY`。

用户的 key 只保存在用户自己浏览器的 `localStorage`，不会写入前端源码。请求会经过你的服务器转发到硅基流动，因此公开部署时仍建议保留限流。

## 反幻觉机制

现在的回答链路是：

```text
用户问题
-> 本地知识库检索
-> 低温模型生成
-> 事实审查
-> 审查不通过则自动重写
-> 返回回答
```

模型被明确禁止编造具体忍者技能、版本强度、帧数、连招、秘卷和通灵效果。知识库没有覆盖时，教练必须说明不确定并追问。

## 知识库

主要维护 `knowledge` 文件夹：

- `ninja_basics.json`：忍者基础介绍，例如技能和机制
- `ninja_playstyles.json`：忍者基础打法思路
- `ninja_tips.json`：忍者使用技巧
- `duel_logic.json`：决斗场底层逻辑，例如走位、骗替身、压场
- `matchup_decisions.json`：具体对局的优秀决策
- `matchmaking.json`：决斗场匹配机制和冲分策略
- `rank_recommendations.json`：不同分段的上分忍者推荐

每次新增或修改知识库后，运行：

```powershell
npm run check
```

## 部署

详细说明见：

[DEPLOYMENT.md](./DEPLOYMENT.md)

## 安全提醒

- 不要把 `.env` 上传到公开仓库。
- 不要把站长自己的 API key 写进前端代码。
- 如果用户 key 截图暴露，建议用户删除旧 key 并重新创建。
- 公开网站建议保留 `RATE_LIMIT_MAX`，避免服务器被滥用转发请求。
