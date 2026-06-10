import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";

// CLIProxyAPI /v1/models 返回的模型条目
interface OpenAIModel {
    id: string;
    object: string;
    owned_by?: string;
}

interface OpenAIModelsResponse {
    object: string;
    data: OpenAIModel[];
}

// CLIProxyAPI /v1/chat/completions 流式 SSE chunk
interface ChatCompletionChunk {
    id: string;
    object: string;
    choices: Array<{
        delta: {
            content?: string;
            tool_calls?: Array<{
                index: number;
                id?: string;
                type?: string;
                function?: {
                    name?: string;
                    arguments?: string;
                };
            }>;
        };
        finish_reason: string | null;
    }>;
}

// 模型能力映射（根据模型名称推断）
function inferCapabilities(modelId: string): { imageInput?: boolean; toolCalling?: boolean } {
    const id = modelId.toLowerCase();
    const imageInput = id.includes("vision") || id.includes("image") || id.includes("gemini") || id.includes("gpt-4o") || id.includes("claude-3") || id.includes("claude-4");
    const toolCalling = !id.includes("o1-mini") && !id.includes("deepseek-r1");
    return { imageInput, toolCalling };
}

// 模型家族推断
function inferFamily(modelId: string): string {
    const id = modelId.toLowerCase();
    if (id.startsWith("gemini")) {
        return "gemini";
    }
    if (id.startsWith("gpt") || id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4")) {
        return "gpt";
    }
    if (id.startsWith("claude")) {
        return "claude";
    }
    if (id.startsWith("deepseek")) {
        return "deepseek";
    }
    if (id.startsWith("kimi")) {
        return "kimi";
    }
    if (id.startsWith("glm")) {
        return "glm";
    }
    return "unknown";
}

// 根据模型名称估算 token 上限
function inferTokenLimits(modelId: string): { maxInputTokens: number; maxOutputTokens: number } {
    const id = modelId.toLowerCase();
    if (id.includes("gemini-2.5-pro") || id.includes("gemini-3")) {
        return { maxInputTokens: 1_000_000, maxOutputTokens: 65536 };
    }
    if (id.includes("gemini-2.5-flash")) {
        return { maxInputTokens: 1_000_000, maxOutputTokens: 65536 };
    }
    if (id.includes("claude-opus-4") || id.includes("claude-sonnet-4")) {
        return { maxInputTokens: 200_000, maxOutputTokens: 32000 };
    }
    if (id.includes("claude")) {
        return { maxInputTokens: 200_000, maxOutputTokens: 8192 };
    }
    if (id.includes("gpt-5") || id.includes("o3") || id.includes("o4")) {
        return { maxInputTokens: 128_000, maxOutputTokens: 32768 };
    }
    if (id.includes("gpt-4o")) {
        return { maxInputTokens: 128_000, maxOutputTokens: 16384 };
    }
    if (id.includes("deepseek")) {
        return { maxInputTokens: 64_000, maxOutputTokens: 8192 };
    }
    return { maxInputTokens: 32_000, maxOutputTokens: 8192 };
}

function getConfig() {
    const cfg = vscode.workspace.getConfiguration("cliproxy");
    const serverUrl = (cfg.get<string>("serverUrl") || "http://localhost:8317").replace(/\/$/, "");
    const apiKey = cfg.get<string>("apiKey") || "";
    const timeoutMs = (cfg.get<number>("requestTimeout") || 120) * 1000;
    return { serverUrl, apiKey, timeoutMs };
}

function buildHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }
    return headers;
}

// 通用 HTTP GET，返回 JSON
function httpGet(url: string, headers: Record<string, string>, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const lib = parsed.protocol === "https:" ? https : http;
        const req = lib.request({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, method: "GET", headers }, (res) => {
            let data = "";
            res.on("data", (chunk: Buffer) => {
                data += chunk.toString();
            });
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`JSON parse error: ${data.slice(0, 200)}`));
                }
            });
        });
        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error("Request timed out"));
        });
        req.on("error", reject);
        req.end();
    });
}

// 将 VS Code 消息格式转换为 OpenAI 格式
function convertMessages(messages: readonly vscode.LanguageModelChatRequestMessage[]): Array<{ role: string; content: string }> {
    return messages.map((msg) => {
        const role = msg.role === vscode.LanguageModelChatMessageRole.User ? "user" : "assistant";
        const content = msg.content
            .filter((part): part is vscode.LanguageModelTextPart => part instanceof vscode.LanguageModelTextPart)
            .map((part) => part.value)
            .join("");
        return { role, content };
    });
}

export class CLIProxyProvider implements vscode.LanguageModelChatProvider {
    // 当模型列表变化时通知 VS Code
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeLanguageModelChatInformation = this._onDidChange.event;

    dispose() {
        this._onDidChange.dispose();
    }

    /** 通知 VS Code 重新拉取模型列表 */
    refresh() {
        this._onDidChange.fire();
    }

    async provideLanguageModelChatInformation(options: { silent: boolean }, _token: vscode.CancellationToken): Promise<vscode.LanguageModelChatInformation[]> {
        const { serverUrl, apiKey, timeoutMs } = getConfig();

        if (options.silent) {
            // 静默模式：服务器未配置时不弹窗，直接返回空
            if (!serverUrl) {
                return [];
            }
        }

        try {
            const resp = (await httpGet(`${serverUrl}/v1/models`, buildHeaders(apiKey), timeoutMs)) as OpenAIModelsResponse;

            if (!resp?.data || !Array.isArray(resp.data)) {
                return [];
            }

            return resp.data.map((m: OpenAIModel): vscode.LanguageModelChatInformation => {
                const { maxInputTokens, maxOutputTokens } = inferTokenLimits(m.id);
                const capabilities = inferCapabilities(m.id);
                return {
                    id: m.id,
                    name: m.id,
                    family: inferFamily(m.id),
                    version: "1.0.0",
                    maxInputTokens,
                    maxOutputTokens,
                    capabilities,
                    detail: `由 CLIProxyAPI 提供 (${serverUrl})`,
                };
            });
        } catch (err) {
            if (!options.silent) {
                vscode.window.showErrorMessage(`CLIProxy: 无法连接到服务器 ${serverUrl}，请检查配置。\n${(err as Error).message}`);
            }
            return [];
        }
    }

    async provideLanguageModelChatResponse(model: vscode.LanguageModelChatInformation, messages: readonly vscode.LanguageModelChatRequestMessage[], options: vscode.ProvideLanguageModelChatResponseOptions, progress: vscode.Progress<vscode.LanguageModelResponsePart>, token: vscode.CancellationToken): Promise<void> {
        const { serverUrl, apiKey, timeoutMs } = getConfig();
        const parsed = new URL(`${serverUrl}/v1/chat/completions`);
        const lib = parsed.protocol === "https:" ? https : http;

        const body = JSON.stringify({
            model: model.id,
            messages: convertMessages(messages),
            stream: true,
            ...(options.tools && options.tools.length > 0
                ? {
                      tools: options.tools.map((t) => ({
                          type: "function",
                          function: {
                              name: t.name,
                              description: t.description,
                              parameters: t.inputSchema,
                          },
                      })),
                  }
                : {}),
        });

        await new Promise<void>((resolve, reject) => {
            const req = lib.request(
                {
                    hostname: parsed.hostname,
                    port: parsed.port,
                    path: parsed.pathname,
                    method: "POST",
                    headers: {
                        ...buildHeaders(apiKey),
                        Accept: "text/event-stream",
                        "Content-Length": Buffer.byteLength(body),
                    },
                },
                (res) => {
                    if (res.statusCode && res.statusCode >= 400) {
                        let errBody = "";
                        res.on("data", (c: Buffer) => {
                            errBody += c.toString();
                        });
                        res.on("end", () => reject(new Error(`HTTP ${res.statusCode}: ${errBody.slice(0, 300)}`)));
                        return;
                    }

                    // 用于拼接跨 chunk 的不完整 SSE 行
                    let buffer = "";
                    // 用于拼接 tool_call 的 arguments 片段
                    const toolCallBuffers: Record<number, { id: string; name: string; args: string }> = {};

                    res.on("data", (chunk: Buffer) => {
                        buffer += chunk.toString();
                        const lines = buffer.split("\n");
                        // 最后一行可能不完整，留到下次
                        buffer = lines.pop() ?? "";

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || trimmed === "data: [DONE]") {
                                continue;
                            }
                            if (!trimmed.startsWith("data: ")) {
                                continue;
                            }

                            try {
                                const data: ChatCompletionChunk = JSON.parse(trimmed.slice(6));
                                const choice = data.choices?.[0];
                                if (!choice) {
                                    continue;
                                }

                                // 文本内容
                                if (choice.delta.content) {
                                    progress.report(new vscode.LanguageModelTextPart(choice.delta.content));
                                }

                                // 工具调用
                                if (choice.delta.tool_calls) {
                                    for (const tc of choice.delta.tool_calls) {
                                        if (!toolCallBuffers[tc.index]) {
                                            toolCallBuffers[tc.index] = { id: tc.id ?? "", name: tc.function?.name ?? "", args: "" };
                                        }
                                        if (tc.id) {
                                            toolCallBuffers[tc.index].id = tc.id;
                                        }
                                        if (tc.function?.name) {
                                            toolCallBuffers[tc.index].name = tc.function.name;
                                        }
                                        if (tc.function?.arguments) {
                                            toolCallBuffers[tc.index].args += tc.function.arguments;
                                        }
                                    }
                                }

                                // 流结束时上报完整的 tool_call
                                if (choice.finish_reason === "tool_calls") {
                                    for (const tc of Object.values(toolCallBuffers)) {
                                        try {
                                            progress.report(new vscode.LanguageModelToolCallPart(tc.id, tc.name, JSON.parse(tc.args || "{}")));
                                        } catch {
                                            // arguments 解析失败时跳过
                                        }
                                    }
                                }
                            } catch {
                                // 忽略单行解析错误，继续处理后续行
                            }
                        }
                    });

                    res.on("end", resolve);
                    res.on("error", reject);
                },
            );

            req.setTimeout(timeoutMs, () => req.destroy(new Error("Request timed out")));
            req.on("error", reject);

            // 支持取消
            token.onCancellationRequested(() => req.destroy(new Error("Cancelled")));

            req.write(body);
            req.end();
        });
    }

    async provideTokenCount(_model: vscode.LanguageModelChatInformation, text: string | vscode.LanguageModelChatRequestMessage, _token: vscode.CancellationToken): Promise<number> {
        // 简单估算：平均 4 个字符 ≈ 1 token（中文约 1.5 字符/token）
        const str =
            typeof text === "string"
                ? text
                : text.content
                      .filter((p): p is vscode.LanguageModelTextPart => p instanceof vscode.LanguageModelTextPart)
                      .map((p) => p.value)
                      .join("");
        return Math.ceil(str.length / 3.5);
    }
}
