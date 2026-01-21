# Layer Management Implementation Guide

This document describes how to implement the layer management functionality in the Draw.io browser extension to support the new MCP Server tools.

## New MCP Tools Added

1. `list-layers` - Lists all available layers
2. `set-active-layer` - Sets the active layer for new elements
3. `move-cell-to-layer` - Moves a cell between layers
4. `get-active-layer` - Gets current active layer info
5. `create-layer` - Creates a new layer

## Extension Implementation

Add these handlers to your Draw.io extension's message handler:

```javascript
// In your extension's message handler
function handleMCPMessage(message) {
  const { __event, __request_id } = message;
  
  switch (__event) {
    case 'list-layers':
      return handleListLayers(message, __request_id);
    case 'set-active-layer':
      return handleSetActiveLayer(message, __request_id);
    case 'move-cell-to-layer':
      return handleMoveCellToLayer(message, __request_id);
    case 'get-active-layer':
      return handleGetActiveLayer(message, __request_id);
    case 'create-layer':
      return handleCreateLayer(message, __request_id);
    // ... existing handlers
  }
}

// List all layers in the diagram
function handleListLayers(message, requestId) {
  try {
    const graph = ui.editor.graph;
    const model = graph.model;
    const root = model.getRoot();
    const layers = [];
    
    for (let i = 0; i < model.getChildCount(root); i++) {
      const layer = model.getChildAt(root, i);
      if (layer) {
        layers.push({
          id: layer.getId(),
          name: layer.getValue() || `Layer ${i}`,
          visible: layer.isVisible(),
          locked: !layer.isConnectable()
        });
      }
    }
    
    sendResponse(requestId, { success: true, layers });
  } catch (error) {
    sendResponse(requestId, { success: false, error: error.message });
  }
}

// Set the active layer for new elements
function handleSetActiveLayer(message, requestId) {
  try {
    const { layer_id } = message;
    const graph = ui.editor.graph;
    const model = graph.model;
    const layer = model.getCell(layer_id);
    
    if (!layer) {
      throw new Error(`Layer with ID ${layer_id} not found`);
    }
    
    // Set the default parent (active layer)
    graph.setDefaultParent(layer);
    
    sendResponse(requestId, { 
      success: true, 
      active_layer: {
        id: layer.getId(),
        name: layer.getValue() || 'Unnamed Layer'
      }
    });
  } catch (error) {
    sendResponse(requestId, { success: false, error: error.message });
  }
}

// Move a cell to a different layer
function handleMoveCellToLayer(message, requestId) {
  try {
    const { cell_id, target_layer_id } = message;
    const graph = ui.editor.graph;
    const model = graph.model;
    
    const cell = model.getCell(cell_id);
    const targetLayer = model.getCell(target_layer_id);
    
    if (!cell) {
      throw new Error(`Cell with ID ${cell_id} not found`);
    }
    
    if (!targetLayer) {
      throw new Error(`Target layer with ID ${target_layer_id} not found`);
    }
    
    model.beginUpdate();
    try {
      // Move the cell to the target layer
      model.add(targetLayer, cell);
    } finally {
      model.endUpdate();
    }
    
    sendResponse(requestId, { 
      success: true, 
      moved_cell: cell_id,
      to_layer: target_layer_id
    });
  } catch (error) {
    sendResponse(requestId, { success: false, error: error.message });
  }
}

// Get current active layer
function handleGetActiveLayer(message, requestId) {
  try {
    const graph = ui.editor.graph;
    const activeLayer = graph.getDefaultParent();
    
    sendResponse(requestId, {
      success: true,
      active_layer: {
        id: activeLayer.getId(),
        name: activeLayer.getValue() || 'Default Layer'
      }
    });
  } catch (error) {
    sendResponse(requestId, { success: false, error: error.message });
  }
}

// Create a new layer
function handleCreateLayer(message, requestId) {
  try {
    const { name } = message;
    const graph = ui.editor.graph;
    const model = graph.model;
    const root = model.getRoot();
    
    model.beginUpdate();
    try {
      // Create new layer
      const newLayer = new mxCell(name);
      newLayer.setId(null); // Let Draw.io assign an ID
      model.add(root, newLayer);
    } finally {
      model.endUpdate();
    }
    
    sendResponse(requestId, {
      success: true,
      layer: {
        id: newLayer.getId(),
        name: name
      }
    });
  } catch (error) {
    sendResponse(requestId, { success: false, error: error.message });
  }
}

// Helper function to send response back to MCP Server
function sendResponse(requestId, data) {
  const response = {
    __request_id: requestId,
    ...data
  };
  
  // Send via WebSocket to MCP Server
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify(response));
  }
}
```

## Usage Examples

Once implemented, you can use these tools from the MCP client:

```javascript
// List all layers
const layers = await mcpClient.callTool('list-layers', {});

// Set active layer
await mcpClient.callTool('set-active-layer', { 
  layer_id: 'J-wuT5nuMxKoC1Huxvf5-130' 
});

// Move element to different layer
await mcpClient.callTool('move-cell-to-layer', {
  cell_id: 'element-123',
  target_layer_id: 'J-wuT5nuMxKoC1Huxvf5-130'
});

// Create new layer
await mcpClient.callTool('create-layer', { 
  name: 'New Layer' 
});
```

## Integration Notes

1. **Error Handling**: All functions include proper error handling and return structured responses
2. **Model Updates**: Layer changes use proper `beginUpdate()`/`endUpdate()` pattern
3. **ID Management**: Uses Draw.io's built-in ID system
4. **Compatibility**: Works with existing Draw.io functionality

## Testing

Test the implementation by:
1. Creating elements in different layers
2. Moving elements between layers
3. Switching active layers
4. Verifying layer visibility and properties