> 此页面为英文原文的机器翻译快照，可能滞后于最新改动，请以英文版本为准。翻译由 `pnpm translate` 自动生成。

# Draw.io MCP 服务器

[English](./README.md) · [简体中文](./README.zh-CN.md)

让我们用最普及的绘图工具 Draw.io（Diagrams.net）来体验 Vibe Diagramming（氛围绘图）吧。

[![Discord channel](https://shields.io/static/v1?logo=discord&message=draw.io%20mcp&label=chat&color=5865F2&logoColor=white)](https://discord.gg/dM4PWdf42q)
[![Build project](https://github.com/lgazo/drawio-mcp-server/actions/workflows/server-ci.yml/badge.svg)](https://github.com/lgazo/drawio-mcp-server/actions/workflows/server-ci.yml)
[![Verified on MseeP](https://mseep.ai/badge.svg)](https://mseep.ai/app/5fc2b7fe-8ceb-4683-97bd-6d31e07b5888)
[![Version](https://img.shields.io/npm/v/drawio-mcp-server)](https://npmjs.com/package/drawio-mcp-server)

## 核心亮点

- Claude Code 插件：执行 `/plugin marketplace add lgazo/drawio-mcp-server` 后执行 `/plugin install drawio`，附带 `/drawio-open` 和 `/drawio-status` 斜杠命令 ![v2.3.0](https://img.shields.io/badge/v2.3.0-blue)
- `npx drawio-mcp-server install <host>` 会为 `claude-code`、`claude-desktop`、`codex`、`zed`、`opencode` 或 `all` 写入相应的 MCP 配置 ![v2.3.0](https://img.shields.io/badge/v2.3.0-blue)
- 文档持久化工具：`set-document-title` 和 `save-document` ![v2.3.0](https://img.shields.io/badge/v2.3.0-blue)
- Draw.io 图形库 API 版本兼容机制 ![v2.2.0](https://img.shields.io/badge/v2.2.0-blue)
- 支持在 IFrame 中启用 Draw.io MCP
- AWS、GCP、Azure、Cisco19 和 CiscoSafe 图形模板可在运行时从 drawio 的侧边栏自动发现
- 通过 `list-documents` 和 `target_document` 选择器实现多文档定位，适用于多标签页工作流
- 通过必填的 `target_page` 选择器实现多页面定位，适用于页面作用域的工具
- 对实时操作按文档进行 FIFO 串行化，使多个智能体可以安全地处理不同文件
- 页面管理工具：`list-pages`、`get-current-page`、`create-page`、`copy-page`、`rename-page`
- 导入、嵌入或展开 [Mermaid](https://mermaid.js.org/) 图表 ![v2.1.0](https://img.shields.io/badge/v2.1.0-blue)
- Firefox 支持已回归，必须启用 TLS 模式 ![v2.1.0](https://img.shields.io/badge/v2.1.0-blue)
- 服务器支持 TLS 模式，并可选择自动生成自签名证书 ![v2.1.0](https://img.shields.io/badge/v2.1.0-blue)

- 支持在 XML、SVG（内嵌 XML）或 PNG（内嵌 XML）之间导入和导出图表 ![v2.0.0](https://img.shields.io/badge/v2.0.0-blue)
- 连线几何控制，支持路径点（waypoint）和自动自连接布线 ![v2.0.0](https://img.shields.io/badge/v2.0.0-blue)
- 支持嵌套形状与分组的父子关系 ![v2.0.0](https://img.shields.io/badge/v2.0.0-blue)
- 服务器与扩展统一在同一 mono-repo 中 ![v2.0.0](https://img.shields.io/badge/v2.0.0-blue)
- 内置 Draw.io 编辑器 - 无需浏览器扩展
- 让 AI 智能体控制 Draw.io 图表的 MCP 服务器
- 通过 MCP 工具以编程方式创建、检查和修改图表
- 面向复杂图表的图层管理
- 兼容任何 MCP 客户端（Claude Desktop、Claude Code、Zed、Codex 等）

## 简介

Draw.io MCP 服务器为 AI 智能体带来 Draw.io 的绘图能力。它提供一组 MCP 工具，可用于创建、读取、更新和删除图表元素——让 AI 助手自动构建架构图、流程图和可视化文档。

有两种使用方式：
1. **内置编辑器** - 服务器直接托管 Draw.io，可在浏览器中访问
2. **浏览器扩展** - 通过扩展连接到浏览器中运行的 Draw.io

实验性功能：与 **draw.io desktop（Electron）应用**的集成仍在进行中，但目前受上游 CSP 问题阻塞 — 参见 [DESKTOP.md](./DESKTOP.md)。

## 环境要求

- **Node.js**（v22 或更高版本；已在 v22 LTS 和 v24 LTS 上测试）- MCP 服务器的运行环境
- **MCP 客户端** - Claude Desktop、Claude Code、Zed、Codex、OpenCode，或任何兼容 MCP 的宿主

### 使用内置编辑器时
无额外要求 - 使用 `--editor` 标志即可开箱即用。

### 使用浏览器扩展时
- **浏览器扩展** - [drawio-mcp-extension](./packages/drawio-mcp-extension/README.md)
- 在你的浏览器中打开 Draw.io

### 可选项
- **pnpm** - 推荐的包管理器（使用 npm 也没问题）

## 快速开始

### 1. 配置你的 MCP 宿主

**最快路径：**

- **Claude Code：** `/plugin marketplace add lgazo/drawio-mcp-server` 然后 `/plugin install drawio`。
- **其他任何宿主：** `npx drawio-mcp-server install <host>`，其中 `<host>` 为 `claude-code`、`claude-desktop`、`codex`、`zed`、`opencode` 或 `all`。

完整参考、可用标志及卸载方式请参见 [docs/PLUGINS.md](./docs/PLUGINS.md)，版本发布方式请参见 [docs/release.md](./docs/release.md)。

<details>
  <summary>手动安装（JSON 配置片段，以 Claude Desktop 为例）</summary>

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

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

</details>

其他 MCP 客户端及详细配置（包括 pnpm 选项）请参见[配置](./CONFIG.zh-CN.md)。

### 2. 打开编辑器

重启 MCP 宿主后，打开：**http://localhost:3000/**

### 3. 开始绘图

可以尝试的示例提示词：

> “创建一张事件驱动架构图，展示一个包含生产者、消费者和三个后端服务的消息队列”

> “创建一张三页的事件驱动架构图。并行使用三个智能体分别负责服务拓扑、消息流转以及重试/失败处理，每个智能体分配到各自独立的目标页面。”

> “绘制一张 CRUD API 图，包含一个数据库、一个 API 网关和四个微服务及其端点”

> “添加一个名为 ‘Background’ 的新图层，并将所有装饰性元素移入其中，然后再新建一个用于标注的图层”

现在，你的 AI 助手就可以使用 MCP 工具来控制图表了。

## 功能特性

服务器提供以下 MCP 工具：

- **文档发现** - 列出已连接的 Draw.io 文档实例，并将后续调用路由到特定的标签页/文件实例
- **图表检查** - 读取形状、页面、图层和单元格属性
- **图表修改** - 在目标页面上添加/编辑/删除形状、连线和标签
- **页面管理** - 列出页面、查看当前页面、创建页面、复制页面和重命名页面，且在受支持的运行时上不会强制切换当前可见页面
- **图层管理** - 创建、切换和整理图层
- **厂商图形覆盖** - AWS、GCP、Azure、Cisco19 和 CiscoSafe 图形模板在运行时从 drawio 的侧边栏自动发现，智能体无需手工维护图形目录即可放置 `mxgraph.gcp2.cloud_run` 或 `mxgraph.cisco19.router` 这类图标
- **内置 TLS** — 可选启用 HTTPS + WSS，可手动提供证书/密钥，或通过每用户本地 CA 自动生成自签名材料。参见 [CONFIG.md → TLS](./CONFIG.zh-CN.md#tls-https--wss)。

完整可用工具列表请参见[工具参考](./TOOLS.zh-CN.md)。

## 安装

服务器作为 MCP 宿主的一部分运行。所有受支持客户端（Claude Desktop、Claude Code、Zed、Codex、oterm）的详细配置（包括 npm 与 pnpm 选项）请参见[配置](./CONFIG.zh-CN.md)。

## 替代方案：浏览器扩展

你也可以不使用内置编辑器，而是通过[浏览器扩展](./packages/drawio-mcp-extension/README.md)连接到浏览器中运行的 Draw.io。无论是否使用 `--editor` 标志均可。

1. 在浏览器中打开 [Draw.io](https://app.diagrams.net/)
2. 安装 Draw.io MCP 浏览器扩展：
   - [Chrome Web Store](https://chrome.google.com/webstore/detail/drawio-mcp-extension/okdbbjbbccdhhfaefmcmekalmmdjjide)
   - [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/drawio-mcp-extension/)
3. 确认扩展已连接（图标上出现绿色信号叠加层）

不使用 `--editor` 时的配置：

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server"]
    }
  }
}
```

更多细节请参见[扩展文档](./packages/drawio-mcp-extension/README.md)。

## 实验性功能：Draw.io Desktop

与 [draw.io desktop](https://github.com/jgraph/drawio-desktop)（Electron）应用的集成目前处于**实验性**阶段，并因一个上游 CSP 问题而端到端受阻。插件可以在 draw.io desktop 内部加载，但其回连 MCP 服务器的 WebSocket 连接会被 draw.io 硬编码的 `connect-src 'self'` 策略拒绝。

完整的设置步骤与当前限制请参见 [DESKTOP.md](./DESKTOP.md)。

## 相关资源

[配置](./CONFIG.zh-CN.md) - CLI 标志与高级选项

[工具参考](./TOOLS.zh-CN.md) - 完整的 MCP 工具文档

[故障排除](./TROUBLESHOOTING.zh-CN.md)

[提示词示例](./docs/examples/index.md)

[参与贡献](./CONTRIBUTING.md)

[架构说明](./ARCHITECTURE.md)

[开发指南](./DEVELOPMENT.md)

[Draw.io Desktop（实验性）](./DESKTOP.md) - 安装路径与已知的 CSP 限制

## Star History

<a href="https://star-history.dera.page/#lgazo/drawio-mcp-server&type=Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=lgazo/drawio-mcp-server&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=lgazo/drawio-mcp-server&type=Date" />
   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=lgazo/drawio-mcp-server&type=Date" />
 </picture>
</a>

## 评估

[![MSeeP.ai Security Assessment Badge](https://mseep.net/pr/lgazo-drawio-mcp-server-badge.png)](https://mseep.ai/app/lgazo-drawio-mcp-server)
