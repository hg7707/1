# 部署说明

这个版本默认使用“用户自填 API key”模式：普通用户在网页里填写自己的硅基流动 API key，站长不需要在服务器上配置自己的 key。

## 推荐环境变量

```text
ALLOW_CLIENT_API_KEYS=true
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3.2
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
RATE_LIMIT_MAX=80
TRUST_PROXY=true
```

不要设置 `SILICONFLOW_API_KEY`，这样可以避免误用站长自己的额度。

## 本地测试

1. 复制 `.env.example` 为 `.env`。
2. 确认 `ALLOW_CLIENT_API_KEYS=true`。
3. 运行：

```powershell
npm install
npm start
```

打开：

```text
http://localhost:3000
```

页面顶部显示“需要 API key”时，说明还没有填写用户 key；用户填写自己的硅基流动 API key 并测试连接后，才能开始对话。

## Docker 部署

```powershell
docker build -t duel-coach .
docker run -p 3000:3000 --env-file .env duel-coach
```

## 云平台部署

在 Render、Railway、Zeabur、飞书云托管或任意 Node.js 云服务器上部署时：

- Build command: `npm install`
- Start command: `npm start`
- Node version: 20 或更高
- Port: 使用平台提供的 `PORT`，本项目会自动读取

在平台的环境变量设置里填入：

```text
ALLOW_CLIENT_API_KEYS=true
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3.2
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX=80
TRUST_PROXY=true
```

## 站长统一付费模式

如果以后想让所有用户共用服务器上的模型 key，可以改成：

```text
ALLOW_CLIENT_API_KEYS=false
SILICONFLOW_API_KEY=你的硅基流动 API key
```

这种模式会消耗站长自己的额度。

## 安全提醒

- 不要把 `.env` 上传到公开仓库。
- 不要把站长自己的 API key 写进前端代码。
- 用户填写的 key 会保存在用户自己的浏览器 `localStorage`。
- 请求仍会经过你的服务器转发到硅基流动，公开后建议保留 `RATE_LIMIT_MAX`。
