> 此页面为英文原文的机器翻译快照，可能滞后于最新改动，请以英文版本为准。翻译由 `pnpm translate` 自动生成。

# 故障排查

## 调试日志

MCP 服务器使用 stdio(标准控制台输出)在 MCP 客户端与 MCP 服务器之间进行通信。在当前的开发阶段，为了提供必要的调试信息，详细日志会以控制台 **error** 输出的形式上报，直到实现更好的日志系统为止。

## 服务器宕机了怎么办？

扩展程序具有指数级重连机制。健壮的连接管理目前尚未到位。

当服务器断开连接时，你应该能在扩展程序中看到重连尝试：

```
[background] WebSocket connection closed CloseEvent {isTrusted: true, wasClean: false, code: 1006, reason: '', type: 'close', …}

Attempting to reconnect in 4.5 seconds... (attempt 1)

[background] broadcast to tabs (2) [{…}, {…}]
[background] WebSocket connection established Event {isTrusted: true, type: 'open', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}
[background] broadcast to tabs (2) [{…}, {…}]
```

目前共有 **5** 次重连尝试，初始延迟为 **3 秒**，并按指数级增长。

你可以在 [chrome://extensions](chrome://extensions) 中重新启用或刷新扩展程序，以强制触发重连。

## MCP 服务器会自行运行吗？

运行 `pnpm` 版本时，应输出以下内容。

```sh
pnpm dlx drawio-mcp-server
```

终端输出：

```
Packages: +109
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved 109, reused 107, downloaded 2, added 109, done
Listening to port 3333 undefined
Draw.io MCP Server running on stdio undefined
```

运行 `npx` 版本时，应输出以下内容。

```sh
npx -y drawio-mcp-server
```

终端输出：
```
DEBUG: Draw.io MCP Server starting (WebSocket extension port: 3333)
DEBUG: [start_websocket_server] Listening to port 3333
DEBUG: Draw.io MCP Server WebSocket started on extension port 3333
DEBUG: Draw.io MCP Server running on stdio
```

使用自定义端口(例如端口 8080)时，你应该会看到：
```
DEBUG: Draw.io MCP Server starting (WebSocket extension port: 8080)
DEBUG: [start_websocket_server] Listening to port 8080
DEBUG: Draw.io MCP Server WebSocket started on extension port 8080
DEBUG: Draw.io MCP Server running on stdio
```

当扩展程序连接时，你应该会看到：

```
DEBUG: [ws_handler] A WebSocket client #0 connected, presumably MCP Extension!
```

### Streamable HTTP 传输

HTTP 传输方式为可选启用项。如果你的 MCP 客户端尝试访问 `/mcp` 时收到 `ECONNREFUSED` 或 404,请确认你已使用 `--transport http`(或 `--transport stdio,http`)启动服务器。启用 HTTP 时的示例输出：

```
DEBUG: Draw.io MCP Server Streamable HTTP transport active
DEBUG: Health check: http://localhost:3000/health
DEBUG: MCP endpoint: http://localhost:3000/mcp
DEBUG: Draw.io MCP Server running on stdio,http
```

使用健康检查验证连通性：

```sh
curl http://localhost:3000/health
```

如果返回 `{"status":"mcp not ready"}`,说明服务器尚未完全启动。请稍等片刻，或使用正确的参数重新启动。

## 端口已被占用

**错误**:`Error: Port 3333 is already in use`

**解决方案**：
1. 检查是哪个进程占用了端口 3333:在 macOS/Linux 上使用 `lsof -i :3333`,在 Windows 上使用 `netstat -ano | findstr :3333`
2. 终止产生冲突的进程，或者
3. 通过在配置中添加 `--extension-port <number>`,让 drawio-mcp-server 改用其他端口

自定义扩展端口的示例：
```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--extension-port", "8888"]
    }
  }
}
```

**HTTP 传输端口冲突**：如果端口 3000 已被占用，请终止产生冲突的服务，或使用 `--http-port <number>` 更改 HTTP 端口，并将 MCP 客户端更新为新的 `/mcp` URL。
