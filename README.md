# 决斗场 AI 教练智能体

这是一个面向《火影忍者手游》决斗场训练的 AI 教练网站。用户打开网站后，必须填写自己的硅基流动 API key 才能和教练对话。

## 当前结构

- 前端：`public`
- 后端：`server.js`
- AI 调用：`src/ai.js`
- 本地兜底教练：`src/chat.js`
- 复盘报告：`src/report.js`
- 知识库：`knowledge`

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

默认模式是让每个用户在网页里填写自己的硅基流动 API key：

```text
ALLOW_CLIENT_API_KEYS=true
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3.2
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
```

用户的 key 只保存在当前浏览器的 `localStorage`，不会写进前端源码，也不会使用站长自己的 key。用户不填 key 时，无法发送对话或调用模型。

如果你确实想改成站长统一付费模式，才需要设置：

```text
ALLOW_CLIENT_API_KEYS=false
SILICONFLOW_API_KEY=你的硅基流动 API key
```

## 知识库

后续主要维护 `knowledge` 文件夹：

- `mechanics.json`：机制知识
- `mistakes.json`：常见错误
- `trainings.json`：训练作业
- `ninjas.json`：忍者知识
- `matchups.json`：对局知识

## 部署

详细部署说明见：

[DEPLOYMENT.md](./DEPLOYMENT.md)

## 安全提醒

- 不要把 `.env` 上传到公开仓库。
- 不要把自己的硅基流动 API key 写进前端代码。
- 如果 API key 曾经截图暴露过，建议删除旧 key 并重新创建。
- 当前模式下请求仍会经过你的服务器转发到模型服务，公开网站建议保留基础 IP 限流。
