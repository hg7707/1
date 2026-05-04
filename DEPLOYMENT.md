# 公开部署说明

这个版本已经改成公开网站模式：普通用户不需要填写 API key，站长在服务器环境变量里配置硅基流动 key。

## 必填环境变量

```text
SILICONFLOW_API_KEY=你的硅基流动 API key
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3.2
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
ALLOW_CLIENT_API_KEYS=false
RATE_LIMIT_MAX=80
TRUST_PROXY=true
```

## 本地生产模式测试

1. 复制 `.env.example` 为 `.env`。
2. 填入 `SILICONFLOW_API_KEY`。
3. 运行：

```powershell
npm install
npm start
```

打开：

```text
http://localhost:3000
```

如果顶部显示“站点 AI 已启用”，说明公开模式已经生效。

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
SILICONFLOW_API_KEY
SILICONFLOW_MODEL
SILICONFLOW_BASE_URL
ALLOW_CLIENT_API_KEYS=false
RATE_LIMIT_MAX=80
TRUST_PROXY=true
```

## 安全提醒

- 不要把 `.env` 上传到公开仓库。
- 不要让普通用户在前端填写你的站长 API key。
- 如果 API key 曾在截图或聊天里暴露过，建议删除旧 key 并重新创建。
- `RATE_LIMIT_MAX` 控制每个 IP 每小时最多请求次数，公开后建议根据余额调低或接入更强的网关限流。
