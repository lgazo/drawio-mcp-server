# Tools Reference

The Draw.io MCP server provides the following MCP tools for programmatic diagram interaction.

## Diagram Inspection Tools

### `get-selected-cell`

Retrieves the currently selected cell in Draw.io with all its attributes.

*Returns*: JSON object containing cell properties (ID, geometry, style, value, etc.)

### `get-shape-categories`

Retrieves available shape categories from the diagram's library.

*Returns*: Array of category objects with their IDs and names

### `get-shapes-in-category`

Retrieves all shapes in a specified category from the diagram's library.

*Parameters*:
- `category_id`: Identifier of the category to retrieve shapes from

*Returns*: Array of shape objects with their properties and styles

### `get-shape-by-name`

Retrieves a specific shape by its name from all available shapes.

*Parameters*:
- `shape_name`: Name of the shape to retrieve

*Returns*: Shape object including its category and style information

### `list-paged-model`

Retrieves a paginated view of all cells (vertices and edges) in the current Draw.io diagram. This tool provides access to the complete model data with essential fields only, sanitized to remove circular dependencies and excessive data. Allows filtering based on multiple criteria and attribute boolean logic. Useful for programmatic inspection of diagram structure without overwhelming response sizes.

## Diagram Modification Tools

### `add-rectangle`

Creates a new rectangle shape on the active Draw.io page with customizable properties:

- Position (`x`, `y` coordinates)
- Dimensions (`width`, `height`)
- Text content
- Visual style (fill color, stroke, etc. using Draw.io style syntax)
- Parent cell (`parent_id`) to create as a child of another shape

### `add-edge`

Creates a connection between two cells (vertices). When source and target are the same shape (self-connector), a loop edge style is automatically applied so the line is visible and selectable.

*Parameters*:
- `source_id`: ID of the source cell
- `target_id`: ID of the target cell
- `text`: Optional text label for the edge
- `style`: Optional style properties for the edge
- `points`: Optional array of `{x, y}` waypoints to control edge routing (useful for custom paths or self-connectors)
- `parent_id`: Optional ID of parent cell (creates as child instead of at diagram root)

### `delete-cell-by-id`

Removes a specified cell from the diagram.

*Parameters*:
- `cell_id`: ID of the cell to delete

### `add-cell-of-shape`

Adds a new cell of a specific shape type from the diagram's library.

*Parameters*:
- `shape_name`: Name of the shape to create
- `x`, `y`: Position coordinates (optional)
- `width`, `height`: Dimensions (optional)
- `text`: Optional text content
- `style`: Optional additional style properties
- `parent_id`: Optional ID of parent cell (creates as child instead of at diagram root)

### `set-cell-shape`

Applies a library shape's style to an existing cell.

*Parameters*:
- `cell_id`: ID of the cell whose appearance should change
- `shape_name`: Name of the library shape whose style should be applied

### `set-cell-data`

Stores or updates a custom attribute on a cell.

*Parameters*:
- `cell_id`: ID of the cell to update
- `key`: Attribute name to set
- `value`: Attribute value (stored as a string internally)

### `edit-cell`

Updates an existing vertex/shape cell in place by ID.

*Parameters*:
- `cell_id`: ID of the cell whose properties should change (required)
- `text`, `x`, `y`, `width`, `height`, `style`: Optional fields to update on the cell; omitted properties stay as-is

### `edit-edge`

Updates an existing edge connection between cells by ID.

*Parameters*:
- `cell_id`: ID of the edge cell to update (required)
- `text`: Optional edge label text
- `source_id`, `target_id`: Optional IDs of new source/target cells
- `style`: Optional replacement style string
- `points`: Optional array of `{x, y}` waypoints to set edge geometry control points (replaces existing waypoints; use empty array to clear)

### `set-cell-parent`

Sets the parent of a cell, making it a child of the specified parent cell. This allows creating hierarchical relationships where moving the parent also moves its children.

*Parameters*:
- `cell_id`: ID of the cell to reparent
- `parent_id`: ID of the new parent cell

*Returns*: Confirmation with cell_id and parent_id

## Layer Management Tools

*Available since v1.7.0*

### `list-layers`

Lists all available layers in the diagram with their IDs and names.

*Returns*: Array of layer objects with properties (ID, name, visibility, locked status)

### `set-active-layer`

Sets the active layer for creating new elements. All subsequent element creation will happen in this layer.

*Parameters*:
- `layer_id`: ID of the layer to set as active

*Returns*: Information about the newly active layer

### `move-cell-to-layer`

Moves a cell from its current layer to a target layer.

*Parameters*:
- `cell_id`: ID of the cell to move
- `target_layer_id`: ID of the target layer where the cell will be moved

*Returns*: Confirmation of the move operation

### `get-active-layer`

Gets the currently active layer information.

*Returns*: Information about the current active layer (ID and name)

### `create-layer`

Creates a new layer in the diagram.

*Parameters*:
- `name`: Name for the new layer

*Returns*: Information about the newly created layer

## Diagram Import/Export Tools

### `export-diagram`

Export the current diagram as SVG, PNG, or XML. Returns the diagram data as base64 (PNG) or text (SVG/XML). Optionally saves to a file.

*Parameters*:
- `format`: Export format: svg for vector graphics, png for raster image, xml for raw diagram data
- `scale`: Zoom factor for the export (1 = 100%, default: 1)
- `border`: Border width in pixels around the diagram (default: 0)
- `background`: Background color in hex format (e.g., #ffffff, default: #ffffff)
- `shadow`: Include shadow effects in the export (default: false)
- `crop`: Crop the export to diagram bounds (true) or full page (false, default: true)
- `selection_only`: Export only the currently selected cells (default: false)
- `transparent`: Use transparent background (overrides background color, default: false)
- `dpi`: DPI for PNG export (affects quality, default: 96)
- `embed_xml`: Embed the diagram XML data in SVG/PNG so it can be reopened in draw.io (default: false)
- `size`: What to export: 'selection' for selected cells only, 'page' for current page, 'diagram' for entire model (default: diagram)
- `output_path`: Absolute file path to save the exported file (must be an absolute path)

*Returns*: Export result with format, mimeType, data (base64 for PNG, text for SVG/XML), dimensions, and optional warning

### `import-diagram`

Import a diagram from XML, SVG with embedded XML, or PNG with embedded XML into the current Draw.io instance.

*Parameters*:
- `data`: The diagram data: raw XML string, or base64-encoded SVG/PNG with embedded XML
- `format`: Input format: xml for raw Draw.io XML, svg for SVG with embedded XML, png for PNG with embedded XML
- `mode`: Import mode: replace clears current diagram and loads new one, add merges imported cells into current diagram, new-page creates a new page with imported diagram (default: replace)
- `filename`: Optional original filename for context

*Returns*: Import result with success status, message, and optional page/cell counts
