# Layer Management Usage Examples

This document provides practical examples of using the new layer management tools in the Draw.io MCP Server.

## Basic Layer Operations

### 1. List All Layers

```javascript
// Get all layers in the current diagram
const layers = await mcpClient.callTool('list-layers', {});
console.log('Available layers:', layers);

// Example response:
// {
//   "success": true,
//   "layers": [
//     {
//       "id": "J-wuT5nuMxKoC1Huxvf5-130",
//       "name": "Background",
//       "visible": true,
//       "locked": false
//     },
//     {
//       "id": "J-wuT5nuMxKoC1Huxvf5-403",
//       "name": "OfertasContainer",
//       "visible": true,
//       "locked": false
//     }
//   ]
// }
```

### 2. Get Current Active Layer

```javascript
// Check which layer is currently active
const activeLayer = await mcpClient.callTool('get-active-layer', {});
console.log('Current active layer:', activeLayer);

// Example response:
// {
//   "success": true,
//   "active_layer": {
//     "id": "J-wuT5nuMxKoC1Huxvf5-130",
//     "name": "Background"
//   }
// }
```

### 3. Switch Active Layer

```javascript
// Set a different layer as active
const result = await mcpClient.callTool('set-active-layer', {
  layer_id: 'J-wuT5nuMxKoC1Huxvf5-403'
});
console.log('Layer switched:', result);

// Now all new elements will be created in the OfertasContainer layer
```

### 4. Create New Layer

```javascript
// Create a new layer for organizing elements
const newLayer = await mcpClient.callTool('create-layer', {
  name: 'Architecture Components'
});
console.log('New layer created:', newLayer);

// Example response:
// {
//   "success": true,
//   "layer": {
//     "id": "new-layer-id-123",
//     "name": "Architecture Components"
//   }
// }
```

## Advanced Layer Management

### 5. Move Elements Between Layers

```javascript
// First, find elements in a specific layer
const elements = await mcpClient.callTool('list-paged-model', {
  filter: {
    cell_type: 'vertex'
  }
});

// Move a specific element to the Background layer
const moveResult = await mcpClient.callTool('move-cell-to-layer', {
  cell_id: 'uRQ5QCWDWeJqXehC0dfH-104', // Legend container
  target_layer_id: 'J-wuT5nuMxKoC1Huxvf5-130' // Background layer
});

console.log('Element moved:', moveResult);
```

### 6. Organize Legend in Background Layer

```javascript
// Complete example: Move legend to background layer
async function moveLegendToBackground() {
  // 1. List all layers to find Background layer ID
  const layers = await mcpClient.callTool('list-layers', {});
  const backgroundLayer = layers.layers.find(layer => layer.name === 'Background');
  
  if (!backgroundLayer) {
    console.error('Background layer not found');
    return;
  }
  
  // 2. Find legend elements (assuming they have specific IDs or are in a container)
  const elements = await mcpClient.callTool('list-paged-model', {
    filter: {
      cell_type: 'vertex'
    }
  });
  
  // 3. Find legend container (assuming it's a rectangle at specific coordinates)
  const legendElements = elements.result.filter(element => 
    element.geometry && 
    element.geometry.x >= 219 && 
    element.geometry.y >= 970 &&
    element.geometry.x <= 609 &&
    element.geometry.y <= 1220
  );
  
  // 4. Move all legend elements to Background layer
  for (const element of legendElements) {
    try {
      await mcpClient.callTool('move-cell-to-layer', {
        cell_id: element.id,
        target_layer_id: backgroundLayer.id
      });
      console.log(`Moved element ${element.id} to Background layer`);
    } catch (error) {
      console.error(`Failed to move element ${element.id}:`, error);
    }
  }
  
  console.log('Legend moved to Background layer successfully!');
}

// Execute the function
moveLegendToBackground();
```

These examples demonstrate how the new layer management tools can be used to create more organized and maintainable Draw.io diagrams programmatically.