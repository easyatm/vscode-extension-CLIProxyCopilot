# CLIProxy for Copilot

<details>
<summary><b>🇨🇳 点击展开中文说明 (Click to expand Chinese documentation)</b></summary>

## 项目简介

**CLIProxy for Copilot** 是一个 VS Code 扩展，它将 [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) 注册为 VS Code 的自定义语言模型提供商（Language Model Chat Provider）。

通过此扩展，你可以直接在 VS Code Copilot Chat 中使用由 CLIProxyAPI 代理的各种大模型（如 Gemini 2.5 Pro, GPT-5, Claude 3.7 Sonnet 等），无需直接配置昂贵的 API Key，充分利用你已有的 OAuth 订阅或免费配额。

## 核心功能

- **模型自动发现**：自动从 CLIProxyAPI 服务器拉取可用模型列表。
- **原生集成**：在 Copilot Chat 的模型选择器中直接切换，享受原生的聊天体验。
- **流式响应**：支持 SSE 流式输出，响应速度快。
- **工具调用支持**：支持 Copilot 的工具调用（Tool Calling）能力。
- **配置简单**：支持通过命令或设置界面快速配置服务器地址和 API Key。

## 快速开始

1. **安装扩展**：在 VS Code 中安装此扩展。
2. **配置服务器**：
   - 运行命令 `CLIProxy: 配置服务器地址和 API Key`。
   - 输入你的 CLIProxyAPI 服务器地址（默认 `http://localhost:8317`）。
   - 如果服务器设置了访问密钥，请输入 API Key。
3. **使用模型**：
   - 打开 Copilot Chat 窗口。
   - 点击模型选择器，选择以 `CLIProxyAPI` 为前缀的模型。
   - 开始对话！

## 扩展设置

此扩展贡献了以下设置：

* `cliproxy.serverUrl`: CLIProxyAPI 服务器的地址。
* `cliproxy.apiKey`: 访问服务器所需的 API Key（可选）。
* `cliproxy.requestTimeout`: 请求超时时间（秒）。

## 常见问题

- **Q: 为什么模型列表里没有看到 CLIProxyAPI 的模型？**
  - A: 请确保 CLIProxyAPI 服务器已启动且地址配置正确。你可以运行 `CLIProxy: 刷新可用模型列表` 命令手动触发刷新。
- **Q: 是否支持图片输入？**
  - A: 扩展会根据模型名称自动推断多模态能力，支持多模态的模型可以直接发送图片。

</details>

---

## Introduction

**CLIProxy for Copilot** is a VS Code extension that registers [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) as a custom Language Model Chat Provider for VS Code.

With this extension, you can use various large language models (such as Gemini 2.5 Pro, GPT-5, Claude 3.7 Sonnet, etc.) proxied by CLIProxyAPI directly within VS Code Copilot Chat. It allows you to leverage your existing OAuth subscriptions or free quotas without needing expensive API keys.

## Key Features

- **Automatic Model Discovery**: Automatically fetches the list of available models from your CLIProxyAPI server.
- **Native Integration**: Switch models directly in the Copilot Chat model picker for a seamless experience.
- **Streaming Responses**: Supports SSE streaming for fast and responsive interactions.
- **Tool Calling Support**: Fully compatible with Copilot's tool calling capabilities.
- **Easy Configuration**: Quickly configure server settings via commands or the settings UI.

## Quick Start

1. **Install the Extension**: Install this extension in your VS Code.
2. **Configure Server**:
   - Run the command `CLIProxy: Configure Server URL and API Key`.
   - Enter your CLIProxyAPI server URL (default: `http://localhost:8317`).
   - Enter the API Key if your server requires authentication.
3. **Use Models**:
   - Open the Copilot Chat window.
   - Click the model picker and select a model prefixed with `CLIProxyAPI`.
   - Start chatting!

## Extension Settings

This extension contributes the following settings:

* `cliproxy.serverUrl`: The URL of your CLIProxyAPI server.
* `cliproxy.apiKey`: The API Key required to access the server (optional).
* `cliproxy.requestTimeout`: Request timeout in seconds.

## Troubleshooting

- **Q: Why don't I see CLIProxyAPI models in the list?**
  - A: Ensure your CLIProxyAPI server is running and the URL is correctly configured. You can run the `CLIProxy: Refresh Available Models` command to trigger a manual refresh.
- **Q: Does it support image input?**
  - A: The extension automatically infers multimodal capabilities based on the model name. Models that support vision can handle image inputs directly.

## License

[MIT](LICENSE)
