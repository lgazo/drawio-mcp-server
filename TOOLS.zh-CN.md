> 此页面为英文原文的机器翻译快照，可能滞后于最新改动，请以英文版本为准。翻译由 `pnpm translate` 自动生成。

# 工具参考

Draw.io MCP 服务器提供以下 MCP 工具，用于以编程方式与图表交互。

## 文档定位

所有实时 Draw.io 工具都作用于已连接的 Draw.io 浏览器标签页。使用 `list-documents` 可查看当前已连接的文档实例。

每个文档实例都会公开以下信息：

- `id`
- `title`
- `mode`
- `hash`
- `file_url`
- `page_count`
- `current_page`

路由规则：

- 如果没有连接任何 Draw.io 文档，实时工具会失败，错误信息为 `No connected Draw.io documents`。
- 如果恰好连接了一个 Draw.io 文档，则 `target_document` 为可选参数，服务器会自动将其选为目标。
- 如果连接了多个 Draw.io 文档，则每个实时工具都必须包含来自 `list-documents` 的 `target_document: { "id": "..." }`。
- 文档 ID 是当前已连接浏览器标签页的实例 ID，而非文件系统路径。
- 在两个标签页中打开同一个底层 `.drawio` 文件会得到两个不同的文档实例。
- 服务器只会向已存在的 Draw.io 标签页发送信号。它不会替你打开文件、打开标签页或切换标签页。

## 页面定位

页面级工具还需要一个 `target_page` 选择器，以便多个代理能够在所选 Draw.io 文档内的不同页面上安全地工作。

必须且只能使用以下之一：

- `{ "index": 0 }`
- `{ "id": "page-id-from-list-pages" }`

注意事项：

- 页面索引从零开始，来源于 `list-pages`。
- 页面 ID 在所选文档内保持稳定，推荐在代理工作流中使用页面 ID。
- 每个已连接文档的实时工具调用都会按 FIFO 顺序串行执行，因此并发代理不会在同一浏览器标签页内交错进行页面切换和写入操作。
- 大多数页面模型工具可以在不切换浏览器可见页面的情况下修改或检查非可见页面上的内容。
- 与 UI 绑定的工具（例如 `get-selected-cell`、`set-active-layer`、`get-active-layer`、`import-diagram`、仅针对选中内容的 `export-diagram`，以及带 `embed_xml=true` 的 PNG `export-diagram`）仍会通过可见页面进行操作，并可能切换该页面。
- 形状库工具（`get-shape-categories`、`get-shapes-in-category`、`get-shape-by-name`）不需要 `target_page`，但它们仍会针对单个已连接文档进行解析，因此在连接了多个文档时需要使用 `target_document`。

## 文档工具

### `list-documents`

列出当前已连接的所有 Draw.io 文档实例。

*返回*：由文档对象组成的数组，包含 `id`、`title`、`mode`、`hash`、`file_url`、`page_count` 和 `current_page`

### `set-document-title`

通过所选 Draw.io 文档当前使用的存储提供程序重命名该文档。当新标题省略扩展名时，会保留当前的 `.drawio`、`.drawio.svg`、`.drawio.png`、`.xml`、`.svg` 或 `.png` 后缀。

*参数*：
- `title`：新文档标题，可带或不带现有扩展名

*返回*：重命名前后的文档标题

### `save-document`

对所选文档触发 Draw.io 现有的 **文件 → 保存** 操作，并保留编辑器当前的存储模式。

该调用确认保存流程已被触发。身份验证、冲突、权限或**另存为**提示可能仍需要在 Draw.io 标签页中进行用户交互。

*返回*：触发状态，以及当前的文档标题和存储模式

## 图表检查工具

### `get-selected-cell`

获取目标页面上当前选中的单元格。

*参数*：
- `target_page`：要检查的页面的选择器

*返回*：包含单元格属性（ID、几何信息、样式、值等）的 JSON 对象

### `get-shape-categories`

从图表的形状库中检索可用的形状类别。类别涵盖精选的 `general` 集合，以及 drawio 自带的所有厂商调色板——AWS（`mxgraph.aws4.*`）、GCP（`mxgraph.gcp2.*`）、Azure（`mxgraph.azure2.*`）、Cisco19（`mxgraph.cisco19.*`）和 CiscoSafe（`mxgraph.cisco_safe.*`）——这些类别在运行时从 drawio 已加载的侧边栏中发现，因此形状目录始终与当前使用的编辑器版本保持一致。

*返回*：由类别对象组成的数组，包含其 ID 和名称

### `get-shapes-in-category`

从图表的形状库中检索指定类别中的所有形状。

*参数*：
- `category_id`：要从中检索形状的类别的标识符

*返回*：由形状对象组成的数组，包含其属性和样式

### `get-shape-by-name`

按名称从所有可用形状中检索指定的形状（general + 在运行时发现的 AWS / GCP / Azure / Cisco19 / CiscoSafe 厂商形状）。

*参数*：
- `shape_name`：要检索的形状的名称（例如 `mxgraph.gcp2.cloud_functions`、`mxgraph.cisco19.router`、`mxgraph.cisco_safe.capability`）

*返回*：形状对象，包含其所属类别和样式信息

### `list-paged-model`

以分页方式检索目标页面上的所有单元格（顶点和边）。该工具提供对完整模型数据的访问，但仅包含必要字段，并已进行清理以移除循环依赖和过多的数据。支持基于多个条件以及属性布尔逻辑进行过滤。

*参数*：
- `target_page`：要检查的页面的选择器
- `page`：分页结果的页码（从零开始）
- `page_size`：返回单元格的最大数量
- `filter`：可选的过滤条件

## 图表修改工具

### `add-rectangle`

在目标页面上创建新的矩形形状，支持自定义以下属性：

- `target_page`：要修改的页面的选择器
- 位置（`x`、`y` 坐标）
- 尺寸（`width`、`height`）
- 文本内容
- 视觉样式（填充颜色、描边等，使用 Draw.io 样式语法）
- 父单元格（`parent_id`），用于将其创建为另一个形状的子级

### `add-edge`

在两个单元格（顶点）之间创建连接。当源与目标为同一形状（自连接）时，会自动应用环回边样式，以确保连线可见且可选择。

*参数*：
- `target_page`：要修改的页面的选择器
- `source_id`：源单元格的 ID
- `target_id`：目标单元格的 ID
- `text`：边的可选文本标签
- `style`：边的可选样式属性
- `points`：可选的 `{x, y}` 途经点数组，用于控制边的布线（对自定义路径或自连接很有用）
- `parent_id`：可选的父单元格 ID（作为子级创建，而不是在图表根级创建）

### `delete-cell-by-id`

从图表中移除指定的单元格。

*参数*：
- `target_page`：要修改的页面的选择器
- `cell_id`：要删除的单元格的 ID

### `add-cell-of-shape`

从图表的形状库中添加一个特定形状类型的新单元格。

*参数*：
- `target_page`：要修改的页面的选择器
- `shape_name`：要创建的形状的名称
- `x`、`y`：位置坐标（可选）
- `width`、`height`：尺寸（可选）
- `text`：可选的文本内容
- `style`：可选的额外样式属性
- `parent_id`：可选的父单元格 ID（作为子级创建，而不是在图表根级创建）

### `set-cell-shape`

将库中形状的样式应用到现有单元格。

*参数*：
- `target_page`：要修改的页面的选择器
- `cell_id`：要更改外观的单元格的 ID
- `shape_name`：要应用其样式的库形状的名称

### `set-cell-data`

在单元格上存储或更新自定义属性。

*参数*：
- `target_page`：要修改的页面的选择器
- `cell_id`：要更新的单元格的 ID
- `key`：要设置的属性名称
- `value`：属性值（内部以字符串形式存储）

### `edit-cell`

按 ID 原地更新现有的顶点/形状单元格。

*参数*：
- `target_page`：要修改的页面的选择器
- `cell_id`：要更改属性的单元格的 ID（必填）
- `text`、`x`、`y`、`width`、`height`、`style`：要在此单元格上更新的可选字段；省略的属性保持不变

### `edit-edge`

按 ID 更新单元格之间现有的边连接。

*参数*：
- `target_page`：要修改的页面的选择器
- `cell_id`：要更新的边单元格的 ID（必填）
- `text`：可选的边标签文本
- `source_id`、`target_id`：可选的新源/目标单元格的 ID
- `style`：可选的替换用样式字符串
- `points`：可选的 `{x, y}` 途经点数组，用于设置边的几何控制点（会替换现有途经点；传入空数组可清除）

### `set-cell-parent`

设置单元格的父级，使其成为指定父单元格的子级。这样可以创建层级关系，移动父级时其子级也会随之移动。

*参数*：
- `target_page`：要修改的页面的选择器
- `cell_id`：要重新指定父级的单元格的 ID
- `parent_id`：新父单元格的 ID

*返回*：包含 cell_id 和 parent_id 的确认信息

## 页面管理工具

### `list-pages`

列出目标/当前 Draw.io 文档中的所有页面。

*返回*：由页面对象组成的数组，包含 `index`、`id`、`name` 和 `is_current`

### `get-current-page`

返回目标/当前 Draw.io 文档中当前可见页面的元数据。

*返回*：页面对象，包含 `index`、`id`、`name` 和 `is_current`

### `create-page`

创建一个新的空白页面并将其追加到目标/当前文档。在受支持的 draw.io 运行时上，此操作不会切换可见页面。

*参数*：
- `name`：新页面的名称

*返回*：所创建页面的元数据

### `copy-page`

在目标/当前文档中创建现有页面的副本，并将该副本追加到页面列表末尾。在可能的情况下，创建副本后会恢复原先的可见页面。

*参数*：
- `page`：要复制的源页面的选择器。必须且只能使用 `{ index }` 或 `{ id }` 之一
- `name`：副本页面的可选名称

*返回*：所复制页面的元数据

### `rename-page`

重命名目标/当前文档中的页面，且不会切换可见页面。

*参数*：
- `page`：要重命名的页面的选择器。必须且只能使用 `{ index }` 或 `{ id }` 之一
- `name`：新页面名称

*返回*：所重命名页面的元数据

## 图层管理工具

*自 v1.7.0 起可用*

### `list-layers`

列出目标页面上所有可用图层及其 ID 和名称。

*参数*：
- `target_page`：要检查的页面的选择器

*返回*：由图层对象组成的数组，包含其属性（ID、名称、可见性、锁定状态）

### `set-active-layer`

设置用于创建新元素的活动图层。之后创建的所有元素都会位于该图层中。

*参数*：
- `target_page`：要修改的页面的选择器
- `layer_id`：要设为活动图层的 ID

*返回*：新活动图层的相关信息

### `move-cell-to-layer`

将单元格从其当前图层移动到目标图层。

*参数*：
- `target_page`：要修改的页面的选择器
- `cell_id`：要移动的单元格的 ID
- `target_layer_id`：单元格将被移动到的目标图层的 ID

*返回*：移动操作的确认信息

### `get-active-layer`

获取目标页面当前活动图层的相关信息。

*参数*：
- `target_page`：要检查的页面的选择器

*返回*：当前活动图层的相关信息（ID 和名称）

### `create-layer`

在目标页面上创建一个新图层。

*参数*：
- `target_page`：要修改的页面的选择器
- `name`：新图层的名称

*返回*：新创建图层的相关信息

## 图表导入/导出工具

### `export-diagram`

将目标页面或当前图表导出为 SVG、PNG 或 XML。以 base64（PNG）或文本（SVG/XML）形式返回图表数据。可选择保存到文件。

注意事项：
- 针对非可见页面目标的页面导出和图表导出，无需切换浏览器可见页面即可执行。
- 仅针对选中内容的导出仍会使用可见页面，因为在 Draw.io 中选中是一项与 UI 绑定的概念。
- 带 `embed_xml=true` 的 PNG 导出同样会使用可见页面，因为 Draw.io 的内嵌 PNG 导出路径仍与 UI 绑定。

*参数*：
- `target_page`：导出所用页面上下文的选择器
- `format`：导出格式：svg 表示矢量图形，png 表示位图图像，xml 表示原始图表数据
- `scale`：导出的缩放系数（1 = 100%，默认：1）
- `border`：图表周围的边框宽度（单位：像素，默认：0）
- `background`：十六进制格式的背景颜色（例如 #ffffff，默认：#ffffff）
- `shadow`：是否在导出中包含阴影效果（默认：false）
- `crop`：将导出裁剪为图表边界（true）还是整页（false，默认：true）
- `selection_only`：仅导出当前选中的单元格（默认：false）
- `transparent`：使用透明背景（会覆盖背景颜色，默认：false）
- `dpi`：PNG 导出的 DPI（影响质量，默认：96）
- `embed_xml`：将图表 XML 数据嵌入 SVG/PNG，以便之后可以在 draw.io 中重新打开（默认：false）
- `size`：要导出的内容：'selection' 表示仅选中单元格，'page' 表示目标页面，'diagram' 表示整个模型（默认：diagram）
- `output_path`：保存导出文件的绝对文件路径（必须是绝对路径）

*返回*：导出结果，包含 format、mimeType、data（PNG 为 base64，SVG/XML 为文本）、尺寸以及可选的警告信息

### `import-diagram`

从 XML、内嵌 XML 的 SVG 或内嵌 XML 的 PNG 导入图表到当前 Draw.io 实例中。

*参数*：
- `target_page`：在 `replace` 和 `add` 模式下必填；在 `new-page` 模式下可选
- `data`：图表数据：原始 XML 字符串，或内嵌 XML 的 base64 编码 SVG/PNG
- `format`：输入格式：xml 表示原始 Draw.io XML，svg 表示内嵌 XML 的 SVG，png 表示内嵌 XML 的 PNG
- `mode`：导入模式：replace 清空当前图表并加载新图表，add 将导入的单元格合并到当前图表，new-page 创建一个包含所导入图表的新页面（默认：replace）
- `filename`：可选的原始文件名，用于提供上下文信息

*返回*：导入结果，包含成功状态、消息以及可选的页面/单元格数量

### `import-mermaid`

将 Mermaid 图表导入 Draw.io 页面。转换在 Draw.io 编辑器内部使用其内置的 Mermaid 管线运行。native 模式将受支持的 Mermaid 图表转换为 mxGraph 单元格；embed 模式则创建一个单独的图像单元格，并保留 Mermaid 源码，以便之后在 Draw.io 中重新编辑。

*参数*：
- `target_page`：在 `replace` 和 `add` 模式下必填；在 `new-page` 模式下可选
- `mermaid_source`：原始 Mermaid 语法
- `mode`：导入模式：native 在受支持时转换为 mxGraph 单元格，embed 将 Mermaid 源码保留在图像单元格中（默认：native）
- `insert_mode`：如何合并转换后的 XML：replace、add 或 new-page（默认：add）

*返回*：导入结果，包含成功状态、消息、转换后的模式、可选的单元格数量以及转换后的 XML
