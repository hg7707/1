# 部署说明

本项目固定使用“用户自填 API key”模式：普通用户在网页里填写自己的硅基流动 API key，站长不需要在服务器上配置自己的 key。

## Render 环境变量

在 Render 服务的 Environment 页面设置：

```text
ALLOW_CLIENT_API_KEYS=true
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3.2
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX=80
TRUST_PROXY=true
```

不要设置：

```text
SILICONFLOW_API_KEY
```

如果 Render 上已经存在 `SILICONFLOW_API_KEY`，请删除。否则服务端会优先使用站长 key。

## Render 构建配置

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`
- Node version: 20 或更高
- Port: 使用 Render 自动注入的 `PORT`

`render.yaml` 已经写入推荐配置。

## 部署后验证

部署完成后访问：

```text
https://你的域名/api/health
```

用户自填 key 模式下，应该看到类似：

```json
{
  "ok": true,
  "provider": "client-siliconflow-key",
  "siliconFlowConfigured": false,
  "allowClientApiKeys": true
}
```

如果看到：

```json
{
  "provider": "requires-siliconflow-key",
  "allowClientApiKeys": false
}
```

说明 Render 没有运行当前代码，或者环境变量没有更新。

## 本地测试

```powershell
npm install
npm run check
npm start
```

打开：

```text
http://localhost:3000
```

页面顶部显示“需要 API key”是正常状态。用户填写自己的硅基流动 API key 并测试连接后，才能开始对话。

## Docker 部署

```powershell
docker build -t duel-coach .
docker run -p 3000:3000 --env-file .env duel-coach
```

## 安全提醒

- 不要把 `.env` 上传到公开仓库。
- 不要把站长自己的 API key 写进前端代码。
- 用户填写的 key 保存在用户自己的浏览器 `localStorage`。
- 请求仍会经过你的服务器转发到硅基流动，公开后建议保留 `RATE_LIMIT_MAX`。
