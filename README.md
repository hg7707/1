# 决斗场 AI 教练智能体

这是一个面向公开网站的火影忍者手游决斗场 AI 教练。普通用户打开网站后可以直接和教练对话，也可以提交赛后复盘。

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

## 公开网站模式

公开部署时，不要让用户在前端填写 API key。站长应该在服务器环境变量里配置：
```text
SILICONFLOW_API_KEY=你的硅基流动 API key
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3.2
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
ALLOW_CLIENT_API_KEYS=false
```

配置成功后，页面顶部会显示“站点 AI 已启用”，所有用户都可以直接使用教练。

## 知识库

你后续主要维护 `knowledge` 文件夹：

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
- 不要把硅基流动 API key 写进前端代码。
- 如果 API key 曾经截图暴露过，建议删除旧 key 并重新创建。
- 公开网站已经带基础 IP 限流，可通过 `RATE_LIMIT_MAX` 调整。
