import * as vscode from 'vscode';
import { CLIProxyProvider } from './provider';

export function activate(context: vscode.ExtensionContext) {
	const provider = new CLIProxyProvider();

	// 注册 Language Model Chat Provider
	context.subscriptions.push(
		vscode.lm.registerLanguageModelChatProvider('cliproxyapi', provider)
	);

	// 命令：打开配置界面
	context.subscriptions.push(
		vscode.commands.registerCommand('cliproxy.manage', async () => {
			const cfg = vscode.workspace.getConfiguration('cliproxy');
			const currentUrl = cfg.get<string>('serverUrl') || 'http://localhost:8317';
			const currentKey = cfg.get<string>('apiKey') || '';

			const url = await vscode.window.showInputBox({
				title: 'CLIProxy: 服务器地址',
				prompt: '输入 CLIProxyAPI 服务器地址',
				value: currentUrl,
				validateInput: (v) => {
					try { new URL(v); return null; }
					catch { return '请输入有效的 URL（例如 http://localhost:8317）'; }
				}
			});
			if (url === undefined) { return; }

			const key = await vscode.window.showInputBox({
				title: 'CLIProxy: API Key',
				prompt: '输入 API Key（如果服务器未配置访问密钥，可留空）',
				value: currentKey,
				password: true,
			});
			if (key === undefined) { return; }

			await cfg.update('serverUrl', url, vscode.ConfigurationTarget.Global);
			await cfg.update('apiKey', key, vscode.ConfigurationTarget.Global);

			provider.refresh();
			vscode.window.showInformationMessage(`CLIProxy: 配置已保存，服务器 ${url}`);
		})
	);

	// 命令：手动刷新模型列表
	context.subscriptions.push(
		vscode.commands.registerCommand('cliproxy.refreshModels', () => {
			provider.refresh();
			vscode.window.showInformationMessage('CLIProxy: 已触发模型列表刷新');
		})
	);

	// 配置变更时自动刷新模型列表
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('cliproxy')) {
				provider.refresh();
			}
		})
	);

	context.subscriptions.push(provider);
}

export function deactivate() {}
