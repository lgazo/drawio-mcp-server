> 此页面为英文原文的机器翻译快照，可能滞后于最新改动，请以英文版本为准。翻译由 `pnpm translate` 自动生成。

# 配置

## CLI 标志与环境变量

每个 CLI 标志都有一个对应的环境变量。CLI 标志的优先级高于环境变量。

| 标志 | 环境变量 | 描述 | 默认值 |
|------|----------------------|-------------|---------|
| `--editor`, `-e` | `DRAWIO_MCP_EDITOR` | 启用内置 Draw.io 编辑器（`true`/`false`） | 禁用 |
| `--extension-port`, `-p` | `DRAWIO_MCP_EXTENSION_PORT` | 浏览器扩展使用的 WebSocket 端口 | 3333 |
| `--http-port` | `DRAWIO_MCP_HTTP_PORT` | HTTP 传输端口 | 3000 |
| `--transport` | `DRAWIO_MCP_TRANSPORT` | 传输类型：`stdio`、`http` 或 `stdio,http` | `stdio` |
| `--asset-path` | `DRAWIO_MCP_ASSET_PATH` | 已下载资源的自定义路径 | - |
| `--host` | `DRAWIO_MCP_HOST` | 所有服务器端点（HTTP、WebSocket）显式使用的 IPv4 或 IPv6 绑定地址 | 未设置（由操作系统选择） |
| `--websocket-url` | `DRAWIO_MCP_WEBSOCKET_URL` | 覆盖向编辑器通告的 WebSocket URL（必须为 `ws://` 或 `wss://`） | 从页面推导 |
| `--logger` | `DRAWIO_MCP_LOGGER` | 日志记录器模式：`console`（写入 stderr）或 `mcp-server`（发送 MCP `notifications/message`）。同时接受旧的下划线形式 `mcp_server` 作为值别名。 | `console` |
| `--tls` | `DRAWIO_MCP_TLS` | 在 HTTP 和 WebSocket 端点上启用 TLS（默认关闭） | 禁用 |
| `--tls-cert <path>` | `DRAWIO_MCP_TLS_CERT` | 手动指定的 TLS 叶证书 PEM（需要 `--tls`，与 `--tls-auto` 互斥） | - |
| `--tls-key <path>` | `DRAWIO_MCP_TLS_KEY` | 手动指定的 TLS 叶私钥 PEM（需要 `--tls`，与 `--tls-auto` 互斥） | - |
| `--tls-auto` | `DRAWIO_MCP_TLS_AUTO` | 通过持久化的本地 CA 自动生成自签名叶证书（需要 `--tls`） | 禁用 |
| `--tls-dir <path>` | `DRAWIO_MCP_TLS_DIR` | 覆盖自动生成的 TLS 材料所在的 XDG 数据目录 | 各操作系统对应的 XDG 路径 |

## 自定义 WebSocket URL（反向代理、HTTPS）

默认情况下，内置编辑器会根据其加载页面构建 WebSocket URL：页面为 HTTPS 时使用 `wss://`，否则使用 `ws://`，并结合页面主机名与 `--extension-port` 的值。如果位于会终止 TLS、并在不同主机、端口或路径上对外提供 WebSocket 的反向代理之后，请设置显式 URL：

```sh
DRAWIO_MCP_WEBSOCKET_URL=wss://drawio.example.com/ws \
  npx -y drawio-mcp-server --editor --transport http
```

或使用等效的 CLI 标志：

```sh
npx -y drawio-mcp-server --editor --transport http \
  --websocket-url wss://drawio.example.com/ws
```

浏览器扩展在其选项页面的 **Custom WebSocket URL** 下也提供同样的覆盖设置；通过 HTTPS 代理连接时请使用该设置。

## 主机绑定

默认情况下，服务器会绑定到由操作系统分配的地址（在 Linux 和 Windows 上通常为 `127.0.0.1`，macOS 上为 `::1`）。在 macOS 以及 `IPV6_V6ONLY=1` 的系统上，操作系统可能只绑定 IPv6，导致浏览器尝试 `ws://localhost:XXXX`（IPv4）时的连接失败。

使用 `--host` 显式指定绑定地址：

```sh
drawio-mcp-server --host 127.0.0.1
```

或使用环境变量：

```sh
DRAWIO_MCP_HOST=127.0.0.1 drawio-mcp-server
```

取值示例：
- `127.0.0.1` — IPv4 环回地址（仅 localhost IPv4）
- `0.0.0.0` — 所有 IPv4 接口
- `::1` — IPv6 环回地址（仅 localhost IPv6）

## 内置编辑器

启用内置编辑器，无需浏览器扩展即可运行 Draw.io：

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--editor"]
    }
  }
}
```

编辑器与 HTTP 传输使用同一端口，可通过以下地址访问：

```
http://localhost:3000/
```

如果您通过 `--http-port` 使用了自定义 HTTP 端口，编辑器将改在该端口提供。

### 编辑器 + HTTP 传输

`--editor` 标志会自动启用 HTTP 传输。如果需要自定义端口：

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--editor", "--http-port", "4000"]
    }
  }
}
```

编辑器位于：`http://localhost:4000/`

## HTTP 传输

如需支持远程 MCP 客户端或通过网络访问，请启用 HTTP 传输：

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--transport", "http"]
    }
  }
}
```

可用端点：
- MCP：`http://localhost:3000/mcp`
- 健康检查：`http://localhost:3000/health`
- 编辑器：`http://localhost:3000/`（若已启用 `--editor`）

## 浏览器扩展

浏览器扩展通过 WebSocket 连接到 MCP 服务器。它既可以与内置编辑器配合使用，也可以独立运行。

默认 WebSocket 端口为 3333。如需自定义：

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--extension-port", "8080"]
    }
  }
}
```

使用自定义端口时，请确保浏览器扩展已配置为连接到相同端口。端口配置说明请参阅[扩展文档](./packages/drawio-mcp-extension/README.md)。

### Firefox：需要 TLS

Firefox 会自动将扩展的 `ws://localhost:<port>` 连接升级为 `wss://`（这是来自 `moz-extension://` 安全上下文的主动混合内容升级）。即使扩展存储了显式的 `ws://` 覆盖设置，该升级同样会触发。此时，纯 WebSocket 服务器会拒绝 TLS 握手，扩展将持续处于断开状态，并显示：

```
Firefox can't establish a connection to the server at wss://localhost:3333/
```

请以 TLS 方式运行服务器，使 WebSocket 端点真正使用 WSS。有两种方式：

1. **`--tls --tls-cert ./server.crt --tls-key ./server.key`** — 自备证书（例如 mkcert）。信任关系已由签发 CA 建立；在 Firefox 中无需其他操作。
2. **`--tls --tls-auto`** — 服务器通过用户级本地 CA 生成自签名叶证书。在该本地 CA 受信任之前，Firefox 将拒绝此证书。可选择以下方式之一：
   - 将 `ca.crt` 导入 Firefox 的 NSS 存储（设置 → 隐私与安全 → 证书 → 证书颁发机构 → 导入）。推荐用于长期使用；重启后依然有效。
   - 在 Firefox 中打开一次 `https://localhost:<port>/`，并点击通过证书警告（“高级 → 接受风险并继续”）。适合快速诊断；该覆盖按主机生效且会持久保留，但 Firefox 偶尔会在配置文件变更后将其丢弃。

自动模式的 CA 路径与续期规则记录在 [TLS](#tls-https--wss) 中。

`dev:firefox` 脚本（`web-ext run`）以放宽的开发首选项启动 Firefox，从而跳过此升级，这就是为什么普通的 `ws://localhost:<port>` 在该模式下可用，而在正常的 Firefox 配置文件中不可用。

## MCP 客户端配置示例

### Claude Desktop

使用 npm：

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--editor"]
    }
  }
}
```

使用 pnpm：

```json
{
  "mcpServers": {
    "drawio": {
      "command": "pnpm",
      "args": ["dlx", "drawio-mcp-server", "--editor"]
    }
  }
}
```

### Claude Code

使用 npm：

```sh
claude mcp add-json drawio '{"type":"stdio","command":"npx","args":["-y","drawio-mcp-server","--editor"]}'
```

使用 pnpm：

```sh
claude mcp add-json drawio '{"type":"stdio","command":"pnpm","args":["dlx","drawio-mcp-server","--editor"]}'
```

### Claude Code（HTTP 传输）

```sh
npx -y drawio-mcp-server --transport http --editor --http-port 4000
claude mcp add-json drawio '{"type":"http","url":"http://localhost:4000/mcp"}'
```

### oterm

配置文件通常位于：`~/.local/share/oterm/config.json`

使用 npm：

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--editor"]
    }
  }
}
```

使用 pnpm：

```json
{
  "mcpServers": {
    "drawio": {
      "command": "pnpm",
      "args": ["dlx", "drawio-mcp-server", "--editor"]
    }
  }
}
```

### Zed

使用 npm：

```json
{
  "drawio": {
    "command": "npx",
    "args": ["-y", "drawio-mcp-server", "--editor"],
    "env": {}
  }
}
```

使用 pnpm：

```json
{
  "drawio": {
    "command": "pnpm",
    "args": ["dlx", "drawio-mcp-server", "--editor"],
    "env": {}
  }
}
```

### Codex

使用 npm：

```toml
[mcp_servers.drawio]
command = "npx"
args = ["-y", "drawio-mcp-server", "--editor"]
```

使用 pnpm：

```toml
[mcp_servers.drawio]
command = "pnpm"
args = ["dlx", "drawio-mcp-server", "--editor"]
```

### Codex（HTTP 传输）

```toml
[mcp_servers.drawio]
url = "http://localhost:3000/mcp"
```

### OpenCode

添加到项目根目录下的 `opencode.json` 或 `~/.config/opencode/opencode.json` 中：

使用 npm：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "drawio": {
      "type": "local",
      "command": ["npx", "-y", "drawio-mcp-server", "--editor"],
      "enabled": true
    }
  }
}
```

使用 pnpm：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "drawio": {
      "type": "local",
      "command": ["pnpm", "dlx", "drawio-mcp-server", "--editor"],
      "enabled": true
    }
  }
}
```

### OpenCode（HTTP 传输）

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "drawio": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "enabled": true
    }
  }
}
```

## 传输选项

`--transport` 标志控制启用哪些传输方式：

- `--transport stdio` - 仅 stdio 传输（默认，对 CLI 友好）
- `--transport http` - 仅 HTTP 传输（用于远程客户端）
- `--transport stdio,http` - 同时启用两种传输

使用内置编辑器（`--editor`）时，HTTP 传输会自动启用。

## TLS（HTTPS + WSS）

服务器可以在两个端点（HTTP 传输 / 内置编辑器，以及 WebSocket 扩展端口）上终止 TLS。有两种模式：

### 手动模式

自备证书与私钥（例如通过 mkcert、Let's Encrypt 或企业 CA 获得）：

```sh
drawio-mcp-server --transport http --editor \
  --tls --tls-cert ./server.crt --tls-key ./server.key
```

两个文件都必须采用 PEM 编码。服务器不会对它们进行链式拼接或修改；如有需要，请在证书文件中提供完整的证书链。

### 自动模式（通过本地 CA 自签名）

服务器会在首次运行时生成一个用户级 CA，以及一张由它签发的叶证书。相关材料会被持久化保存，后续运行将复用它们：

```sh
drawio-mcp-server --transport http --editor --tls --tls-auto
```

默认存储位置（符合 XDG 规范）：

| 操作系统 | 路径 |
|----|------|
| Linux | `${XDG_DATA_HOME:-~/.local/share}/drawio-mcp-server/tls/` |
| macOS | `~/Library/Application Support/drawio-mcp-server/tls/` |
| Windows | `%LOCALAPPDATA%\drawio-mcp-server\tls\` |

文件：

- `ca.crt` — 本地 CA，只需安装一次到操作系统 / 浏览器的信任存储
- `ca.key` — CA 私钥（在 POSIX 上权限为 `0600`，切勿共享）
- `server.crt` — 叶证书（有效期 1 年，SAN 列表变化时会重新生成）
- `server.key` — 叶私钥（在 POSIX 上权限为 `0600`）
- `meta.json` — 生成时间戳 + 用于漂移检测的 SAN 哈希

可通过 `--tls-dir` 或 `DRAWIO_MCP_TLS_DIR` 覆盖该目录（例如用于 Docker 卷）。

### 信任存储安装

首次以自动模式运行时，服务器会打印将 `ca.crt` 安装到信任存储的操作系统专用命令。如果不执行该操作，浏览器将拒绝 WSS 连接（浏览器扩展会表现为静默断开）。快速参考：

- **Linux（Debian/Ubuntu）：** `sudo cp <ca.crt> /usr/local/share/ca-certificates/drawio-mcp-ca.crt && sudo update-ca-certificates`
- **Linux（Fedora/RHEL）：** `sudo cp <ca.crt> /etc/pki/ca-trust/source/anchors/drawio-mcp-ca.crt && sudo update-ca-trust extract`
- **Linux（Arch/Manjaro）：** `sudo trust anchor --store <ca.crt>`
- **macOS：** `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <ca.crt>`
- **Windows（管理员）：** `certutil -addstore -f ROOT <ca.crt>`
- **Firefox：** 使用自身的 NSS 存储 — 通过“设置 → 隐私与安全 → 证书 → 证书颁发机构 → 导入”进行导入
- **Linux 上的 Chrome/Chromium：** 在多数发行版上会读取系统信任存储，但可能需要注销/重新登录（或运行 `nss-certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n drawio-mcp -i <ca.crt>`）才能识别新证书。作为临时诊断手段，可以使用 `google-chrome --ignore-certificate-errors` 启动。

安装完成后请重启浏览器。

### 续期

- 叶证书会在距过期不足 30 天，或 SAN 列表发生变化（例如您添加了 `--host`）时自动续期。
- CA 会在距其 10 年有效期届满不足 30 天时续期。CA 续期后，您必须将 `ca.crt` 重新安装到信任存储中。
- 若要强制重新生成，请删除 TLS 目录。

## 日志

只要 `stdio` 传输处于活动状态，服务器就会将 stdout 保留给 MCP JSON-RPC 帧。诊断输出会经由两个日志记录器之一进行路由，可使用 `--logger` 选择：

- `--logger console`（默认）写入 **stderr**。对于严格执行规范的 stdio MCP 客户端（例如 Claude Desktop、Codex CLI）而言是安全的。
- `--logger mcp-server` 会将日志以 `notifications/message` 的形式发送给已连接的 MCP 客户端。这会通告 `logging` 能力，并允许客户端在运行时通过 `logging/setLevel` 调整各日志记录器的级别。仅当您的客户端支持 MCP 日志通知时才使用此选项。

示例：

```sh
drawio-mcp-server --editor --logger mcp-server
DRAWIO_MCP_LOGGER=mcp-server drawio-mcp-server --editor
```

> **注意（破坏性变更）：** 先前的 `LOGGER_TYPE` 环境变量已被移除。请改用 `--logger` 或 `DRAWIO_MCP_LOGGER`。

## install 子命令

`drawio-mcp-server install <host>` 用于在各宿主应用的配置文件中写入和移除 MCP 条目。完整参考请见 [docs/PLUGINS.md](./docs/PLUGINS.md)。
