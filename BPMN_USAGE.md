# BPMN 2.0 Usage Guide

Complete reference for using BPMN 2.0 tools in the draw.io MCP Server.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [BPMN Events](#bpmn-events)
4. [BPMN Tasks](#bpmn-tasks)
5. [BPMN Gateways](#bpmn-gateways)
6. [BPMN Swimlanes](#bpmn-swimlanes)
7. [BPMN Flows](#bpmn-flows)
8. [BPMN Data Objects](#bpmn-data-objects)
9. [BPMN Artifacts](#bpmn-artifacts)
10. [Complete Examples](#complete-examples)

---

## Overview

The draw.io MCP Server now supports **BPMN 2.0** (Business Process Model and Notation), enabling you to create professional business process diagrams programmatically. This implementation supports:

- **59 Event Types** (Start, Intermediate, End, Boundary with 13 symbol types)
- **12 Task Types** (User, Service, Manual, Send, Receive, Business Rule, Script)
- **7 Gateway Types** (Exclusive, Parallel, Inclusive, Event-Based, Complex)
- **Swimlanes** (Pools and Lanes for organizing process participants)
- **4 Flow Types** (Sequence, Message, Association, Data Association)
- **Data Objects & Stores** (Information artifacts)
- **Text Annotations & Groups** (Documentation artifacts)

All BPMN elements are rendered using authentic BPMN 2.0 notation compatible with industry standards.

---

## Quick Start

### Basic Process Example

```typescript
// 1. Add a start event
add-bpmn-event({
  x: 100,
  y: 100,
  symbol: "general",
  position: "start",
  text: "Start"
})

// 2. Add a user task
add-bpmn-task({
  x: 250,
  y: 80,
  marker: "user",
  text: "Review Application"
})

// 3. Add an end event
add-bpmn-event({
  x: 450,
  y: 100,
  symbol: "general",
  position: "end",
  text: "End"
})

// 4. Connect them with sequence flows
add-bpmn-flow({
  sourceId: "<start-event-id>",
  targetId: "<task-id>",
  type: "sequence"
})

add-bpmn-flow({
  sourceId: "<task-id>",
  targetId: "<end-event-id>",
  type: "sequence"
})
```

---

## BPMN Events

Events represent things that happen during a process. BPMN defines 59 distinct event types based on:
- **Position**: Start, Intermediate, End, or Boundary
- **Symbol**: Message, Timer, Error, Signal, etc.
- **Behavior**: Catching vs Throwing, Interrupting vs Non-Interrupting

### Tool: `add-bpmn-event`

Add a BPMN event to the diagram.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | number | No | 100 | X-axis position |
| `y` | number | No | 100 | Y-axis position |
| `width` | number | No | 30 | Event width (diameter) |
| `height` | number | No | 30 | Event height (diameter) |
| `text` | string | No | "" | Label text |
| `symbol` | EventSymbol | Yes | - | Event symbol type |
| `position` | EventPosition | Yes | - | Event position type |
| `interrupting` | boolean | No | true | Interrupting flag (start/boundary) |
| `throwing` | boolean | No | false | Throwing flag (intermediate) |
| `style` | string | No | - | Additional custom styles |

#### Event Symbols

- `"general"` - None/General event (circle only)
- `"message"` - Message event (envelope icon)
- `"timer"` - Timer event (clock icon)
- `"escalation"` - Escalation event (arrow up icon)
- `"conditional"` - Conditional event (document icon)
- `"link"` - Link event (arrow icon)
- `"error"` - Error event (lightning bolt icon)
- `"cancel"` - Cancel event (X icon)
- `"compensation"` - Compensation event (rewind icon)
- `"signal"` - Signal event (triangle icon)
- `"multiple"` - Multiple event (pentagon icon)
- `"parallelMultiple"` - Parallel Multiple event (plus icon)
- `"terminate"` - Terminate event (filled circle)

#### Event Positions

- `"start"` - Start event (single thin circle)
- `"intermediate"` - Intermediate event (double thin circles)
- `"end"` - End event (single thick circle)
- `"boundary"` - Boundary event (attached to activity)

### Examples

#### Start Events

```typescript
// None Start Event
add-bpmn-event({
  x: 100, y: 100,
  symbol: "general",
  position: "start",
  text: "Start"
})

// Message Start Event
add-bpmn-event({
  x: 100, y: 200,
  symbol: "message",
  position: "start",
  text: "Message Received"
})

// Timer Start Event (Non-Interrupting)
add-bpmn-event({
  x: 100, y: 300,
  symbol: "timer",
  position: "start",
  interrupting: false,
  text: "Every Monday"
})
```

#### Intermediate Events

```typescript
// Message Intermediate Catching Event
add-bpmn-event({
  x: 300, y: 100,
  symbol: "message",
  position: "intermediate",
  throwing: false,
  text: "Wait for Reply"
})

// Message Intermediate Throwing Event
add-bpmn-event({
  x: 300, y: 200,
  symbol: "message",
  position: "intermediate",
  throwing: true,
  text: "Send Notification"
})

// Timer Intermediate Event
add-bpmn-event({
  x: 300, y: 300,
  symbol: "timer",
  position: "intermediate",
  text: "Wait 2 Days"
})
```

#### End Events

```typescript
// None End Event
add-bpmn-event({
  x: 500, y: 100,
  symbol: "general",
  position: "end",
  text: "End"
})

// Error End Event
add-bpmn-event({
  x: 500, y: 200,
  symbol: "error",
  position: "end",
  text: "Error Occurred"
})

// Terminate End Event
add-bpmn-event({
  x: 500, y: 300,
  symbol: "terminate",
  position: "end",
  text: "Terminate All"
})
```

#### Boundary Events

```typescript
// Timer Boundary Event (Interrupting)
add-bpmn-event({
  x: 350, y: 150,  // Attach to edge of task
  symbol: "timer",
  position: "boundary",
  interrupting: true,
  text: "Timeout"
})

// Error Boundary Event (Always Interrupting)
add-bpmn-event({
  x: 350, y: 200,
  symbol: "error",
  position: "boundary",
  interrupting: true,
  text: "Error Handler"
})

// Message Boundary Event (Non-Interrupting)
add-bpmn-event({
  x: 350, y: 250,
  symbol: "message",
  position: "boundary",
  interrupting: false,
  text: "Status Update"
})
```

---

## BPMN Tasks

Tasks represent work to be performed in a process. BPMN defines different task types with specific markers and characteristics.

### Tool: `add-bpmn-task`

Add a BPMN task or activity to the diagram.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | number | No | 100 | X-axis position |
| `y` | number | No | 100 | Y-axis position |
| `width` | number | No | 100 | Task width |
| `height` | number | No | 60 | Task height |
| `text` | string | No | "Task" | Task label |
| `marker` | TaskMarker | No | - | Task type marker |
| `isLoopStandard` | boolean | No | false | Standard loop indicator |
| `isLoopMultiSeq` | boolean | No | false | Multi-instance sequential |
| `isLoopMultiPar` | boolean | No | false | Multi-instance parallel |
| `isAdHoc` | boolean | No | false | Ad-hoc marker |
| `isCompensation` | boolean | No | false | Compensation marker |
| `isSubProcess` | boolean | No | false | Is a subprocess |
| `isCallActivity` | boolean | No | false | Is a call activity |
| `style` | string | No | - | Additional custom styles |

#### Task Markers

- `"user"` - User Task (person icon)
- `"service"` - Service Task (gear icon)
- `"manual"` - Manual Task (hand icon)
- `"send"` - Send Task (filled envelope icon)
- `"receive"` - Receive Task (empty envelope icon)
- `"businessRule"` - Business Rule Task (table icon)
- `"script"` - Script Task (document icon)

### Examples

#### Basic Tasks

```typescript
// Generic Task
add-bpmn-task({
  x: 200, y: 100,
  text: "Process Request"
})

// User Task
add-bpmn-task({
  x: 200, y: 200,
  marker: "user",
  text: "Review Application"
})

// Service Task
add-bpmn-task({
  x: 200, y: 300,
  marker: "service",
  text: "Calculate Premium"
})

// Send Task
add-bpmn-task({
  x: 200, y: 400,
  marker: "send",
  text: "Send Confirmation Email"
})
```

#### Tasks with Loop Indicators

```typescript
// Standard Loop
add-bpmn-task({
  x: 200, y: 100,
  marker: "user",
  text: "Review Document",
  isLoopStandard: true
})

// Multi-Instance Sequential
add-bpmn-task({
  x: 200, y: 200,
  marker: "user",
  text: "Approve (Sequential)",
  isLoopMultiSeq: true
})

// Multi-Instance Parallel
add-bpmn-task({
  x: 200, y: 300,
  marker: "service",
  text: "Process (Parallel)",
  isLoopMultiPar: true
})
```

#### Subprocess and Call Activity

```typescript
// Subprocess
add-bpmn-task({
  x: 200, y: 100,
  width: 150,
  height: 100,
  text: "Handle Payment",
  isSubProcess: true
})

// Call Activity
add-bpmn-task({
  x: 200, y: 250,
  width: 150,
  height: 100,
  text: "Credit Check Process",
  isCallActivity: true
})

// Subprocess with Multi-Instance
add-bpmn-task({
  x: 200, y: 400,
  width: 150,
  height: 100,
  text: "Process Items",
  isSubProcess: true,
  isLoopMultiPar: true
})
```

---

## BPMN Gateways

Gateways control the flow of a process, representing decisions, parallelization, or convergence points.

### Tool: `add-bpmn-gateway`

Add a BPMN gateway to the diagram.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | number | No | 100 | X-axis position |
| `y` | number | No | 100 | Y-axis position |
| `width` | number | No | 50 | Gateway width |
| `height` | number | No | 50 | Gateway height |
| `text` | string | No | "" | Gateway label |
| `type` | GatewayType | Yes | - | Gateway type |
| `instantiate` | boolean | No | false | Instantiate marker (event-based) |
| `style` | string | No | - | Additional custom styles |

#### Gateway Types

- `"exclusive"` - Exclusive Gateway (XOR) - diamond with X
- `"parallel"` - Parallel Gateway (AND) - diamond with +
- `"inclusive"` - Inclusive Gateway (OR) - diamond with O
- `"eventBased"` - Event-Based Gateway - diamond with pentagon
- `"complex"` - Complex Gateway - diamond with asterisk
- `"exclusiveEventBased"` - Exclusive Event-Based Gateway
- `"parallelEventBased"` - Parallel Event-Based Gateway

### Examples

```typescript
// Exclusive Gateway (Decision Point)
add-bpmn-gateway({
  x: 300, y: 100,
  type: "exclusive",
  text: "Approved?"
})

// Parallel Gateway (Fork/Join)
add-bpmn-gateway({
  x: 300, y: 200,
  type: "parallel",
  text: "Process in Parallel"
})

// Inclusive Gateway
add-bpmn-gateway({
  x: 300, y: 300,
  type: "inclusive",
  text: "Check Conditions"
})

// Event-Based Gateway
add-bpmn-gateway({
  x: 300, y: 400,
  type: "eventBased",
  text: "Wait for Event"
})
```

---

## BPMN Swimlanes

Swimlanes organize process elements by participant (pools) or role (lanes).

### Tool: `add-bpmn-swimlane`

Add a BPMN pool or lane to the diagram.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | number | No | 100 | X-axis position |
| `y` | number | No | 100 | Y-axis position |
| `width` | number | No | 600/400 | Swimlane width |
| `height` | number | No | 300/150 | Swimlane height |
| `text` | string | No | "Pool"/"Lane" | Swimlane label |
| `type` | SwimlaneType | Yes | - | Type (pool or lane) |
| `horizontal` | boolean | No | true | Horizontal orientation |
| `parentId` | string | No | - | Parent pool ID (for lanes) |
| `style` | string | No | - | Additional custom styles |

#### Swimlane Types

- `"pool"` - Pool (process participant)
- `"lane"` - Lane (role or responsibility)

### Examples

```typescript
// Horizontal Pool
add-bpmn-swimlane({
  x: 50, y: 50,
  width: 800,
  height: 400,
  type: "pool",
  text: "Customer Service Department"
})

// Lanes within Pool
add-bpmn-swimlane({
  x: 50, y: 50,
  width: 800,
  height: 200,
  type: "lane",
  text: "Front Office",
  parentId: "<pool-id>"
})

add-bpmn-swimlane({
  x: 50, y: 250,
  width: 800,
  height: 200,
  type: "lane",
  text: "Back Office",
  parentId: "<pool-id>"
})

// Vertical Pool
add-bpmn-swimlane({
  x: 50, y: 50,
  width: 300,
  height: 600,
  type: "pool",
  horizontal: false,
  text: "System"
})
```

---

## BPMN Flows

Flows connect BPMN elements, representing sequence flow, message flow, or associations.

### Tool: `add-bpmn-flow`

Add a BPMN flow connector between elements.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sourceId` | string | Yes | - | Source cell ID |
| `targetId` | string | Yes | - | Target cell ID |
| `text` | string | No | "" | Flow label |
| `type` | FlowType | Yes | - | Flow type |
| `sequenceFlowType` | SequenceFlowType | No | "normal" | Sequence flow subtype |
| `associationDirection` | AssociationDirection | No | "none" | Association direction |
| `bidirectional` | boolean | No | false | Bidirectional message flow |
| `style` | string | No | - | Additional custom styles |

#### Flow Types

- `"sequence"` - Sequence Flow (solid line with arrow)
- `"message"` - Message Flow (dashed line with open arrow)
- `"association"` - Association (dotted line)
- `"dataAssociation"` - Data Association (dotted line with arrow)

#### Sequence Flow Types

- `"normal"` - Normal sequence flow
- `"conditional"` - Conditional flow (diamond at source)
- `"default"` - Default flow (slash at source)

#### Association Directions

- `"none"` - Undirected
- `"one"` - Unidirectional
- `"both"` - Bidirectional

### Examples

```typescript
// Normal Sequence Flow
add-bpmn-flow({
  sourceId: "<task-1-id>",
  targetId: "<task-2-id>",
  type: "sequence",
  text: ""
})

// Conditional Sequence Flow
add-bpmn-flow({
  sourceId: "<gateway-id>",
  targetId: "<task-id>",
  type: "sequence",
  sequenceFlowType: "conditional",
  text: "amount > 1000"
})

// Default Sequence Flow
add-bpmn-flow({
  sourceId: "<gateway-id>",
  targetId: "<task-id>",
  type: "sequence",
  sequenceFlowType: "default",
  text: "else"
})

// Message Flow
add-bpmn-flow({
  sourceId: "<task-pool-1>",
  targetId: "<task-pool-2>",
  type: "message",
  text: "Request"
})

// Bidirectional Message Flow
add-bpmn-flow({
  sourceId: "<task-pool-1>",
  targetId: "<task-pool-2>",
  type: "message",
  bidirectional: true,
  text: "Request/Response"
})

// Association
add-bpmn-flow({
  sourceId: "<task-id>",
  targetId: "<annotation-id>",
  type: "association",
  associationDirection: "one"
})
```

---

## BPMN Data Objects

Data objects represent information flowing through the process.

### Tool: `add-bpmn-data-object`

Add a BPMN data object to the diagram.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | number | No | 100 | X-axis position |
| `y` | number | No | 100 | Y-axis position |
| `width` | number | No | 40/60 | Data object width |
| `height` | number | No | 50/60 | Data object height |
| `text` | string | No | "Data" | Data object label |
| `type` | DataObjectType | Yes | - | Data object type |
| `isCollection` | boolean | No | false | Collection indicator |
| `style` | string | No | - | Additional custom styles |

#### Data Object Types

- `"dataObject"` - Data Object
- `"dataInput"` - Data Input
- `"dataOutput"` - Data Output
- `"dataStore"` - Data Store Reference

### Examples

```typescript
// Data Object
add-bpmn-data-object({
  x: 400, y: 100,
  type: "dataObject",
  text: "Application Form"
})

// Data Collection
add-bpmn-data-object({
  x: 400, y: 200,
  type: "dataObject",
  isCollection: true,
  text: "Documents"
})

// Data Store
add-bpmn-data-object({
  x: 400, y: 300,
  type: "dataStore",
  text: "Customer Database"
})

// Data Input
add-bpmn-data-object({
  x: 100, y: 400,
  type: "dataInput",
  text: "Request Data"
})

// Data Output
add-bpmn-data-object({
  x: 500, y: 400,
  type: "dataOutput",
  text: "Result"
})
```

---

## BPMN Artifacts

Artifacts provide additional information about the process.

### Tool: `add-bpmn-text-annotation`

Add a BPMN text annotation to the diagram.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | number | No | 100 | X-axis position |
| `y` | number | No | 100 | Y-axis position |
| `width` | number | No | 100 | Annotation width |
| `height` | number | No | 50 | Annotation height |
| `text` | string | No | "Annotation" | Annotation text |
| `style` | string | No | - | Additional custom styles |

### Tool: `add-bpmn-group`

Add a BPMN group to the diagram.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | number | No | 100 | X-axis position |
| `y` | number | No | 100 | Y-axis position |
| `width` | number | No | 200 | Group width |
| `height` | number | No | 150 | Group height |
| `text` | string | No | "" | Group label |
| `style` | string | No | - | Additional custom styles |

### Examples

```typescript
// Text Annotation
add-bpmn-text-annotation({
  x: 400, y: 50,
  width: 150,
  height: 60,
  text: "This process handles customer complaints within 24 hours."
})

// Connect annotation to task
add-bpmn-flow({
  sourceId: "<task-id>",
  targetId: "<annotation-id>",
  type: "association",
  associationDirection: "one"
})

// Group
add-bpmn-group({
  x: 150, y: 150,
  width: 400,
  height: 200,
  text: "Payment Handling"
})
```

---

## Complete Examples

### Example 1: Simple Approval Process

```typescript
// Start event
const start = add-bpmn-event({
  x: 100, y: 200,
  symbol: "general",
  position: "start",
  text: "Request Submitted"
})

// User task: Review
const review = add-bpmn-task({
  x: 200, y: 170,
  marker: "user",
  text: "Review Request"
})

// Exclusive gateway: Decision
const decision = add-bpmn-gateway({
  x: 350, y: 185,
  type: "exclusive",
  text: "Approved?"
})

// Service task: Notify approval
const notifyApprove = add-bpmn-task({
  x: 450, y: 100,
  marker: "send",
  text: "Send Approval"
})

// Service task: Notify rejection
const notifyReject = add-bpmn-task({
  x: 450, y: 240,
  marker: "send",
  text: "Send Rejection"
})

// End events
const endApprove = add-bpmn-event({
  x: 600, y: 115,
  symbol: "general",
  position: "end",
  text: "Approved"
})

const endReject = add-bpmn-event({
  x: 600, y: 255,
  symbol: "general",
  position: "end",
  text: "Rejected"
})

// Connect with sequence flows
add-bpmn-flow({
  sourceId: start.id,
  targetId: review.id,
  type: "sequence"
})

add-bpmn-flow({
  sourceId: review.id,
  targetId: decision.id,
  type: "sequence"
})

add-bpmn-flow({
  sourceId: decision.id,
  targetId: notifyApprove.id,
  type: "sequence",
  sequenceFlowType: "conditional",
  text: "Yes"
})

add-bpmn-flow({
  sourceId: decision.id,
  targetId: notifyReject.id,
  type: "sequence",
  sequenceFlowType: "default",
  text: "No"
})

add-bpmn-flow({
  sourceId: notifyApprove.id,
  targetId: endApprove.id,
  type: "sequence"
})

add-bpmn-flow({
  sourceId: notifyReject.id,
  targetId: endReject.id,
  type: "sequence"
})
```

### Example 2: Process with Swimlanes

```typescript
// Create pool
const pool = add-bpmn-swimlane({
  x: 50, y: 50,
  width: 800,
  height: 400,
  type: "pool",
  text: "Order Fulfillment"
})

// Create lanes
const salesLane = add-bpmn-swimlane({
  x: 50, y: 50,
  width: 800,
  height: 200,
  type: "lane",
  text: "Sales",
  parentId: pool.id
})

const warehouseLane = add-bpmn-swimlane({
  x: 50, y: 250,
  width: 800,
  height: 200,
  type: "lane",
  text: "Warehouse",
  parentId: pool.id
})

// Sales lane activities
const orderReceived = add-bpmn-event({
  x: 100, y: 130,
  symbol: "message",
  position: "start",
  text: "Order Received"
})

const processOrder = add-bpmn-task({
  x: 200, y: 100,
  marker: "user",
  text: "Process Order"
})

const confirmOrder = add-bpmn-task({
  x: 650, y: 100,
  marker: "send",
  text: "Confirm Shipment"
})

// Warehouse lane activities
const pickItems = add-bpmn-task({
  x: 350, y: 300,
  marker: "manual",
  text: "Pick Items"
})

const packItems = add-bpmn-task({
  x: 500, y: 300,
  marker: "manual",
  text: "Pack Items"
})

// Flows
add-bpmn-flow({
  sourceId: orderReceived.id,
  targetId: processOrder.id,
  type: "sequence"
})

add-bpmn-flow({
  sourceId: processOrder.id,
  targetId: pickItems.id,
  type: "message",
  text: "Pick List"
})

add-bpmn-flow({
  sourceId: pickItems.id,
  targetId: packItems.id,
  type: "sequence"
})

add-bpmn-flow({
  sourceId: packItems.id,
  targetId: confirmOrder.id,
  type: "message",
  text: "Ready"
})
```

### Example 3: Process with Parallel Gateway

```typescript
// Start
const start = add-bpmn-event({
  x: 100, y: 200,
  symbol: "general",
  position: "start"
})

// Initial task
const prepare = add-bpmn-task({
  x: 200, y: 170,
  text: "Prepare Document"
})

// Parallel gateway (fork)
const fork = add-bpmn-gateway({
  x: 350, y: 185,
  type: "parallel"
})

// Parallel tasks
const legal = add-bpmn-task({
  x: 450, y: 100,
  marker: "user",
  text: "Legal Review"
})

const finance = add-bpmn-task({
  x: 450, y: 170,
  marker: "user",
  text: "Finance Review"
})

const tech = add-bpmn-task({
  x: 450, y: 240,
  marker: "user",
  text: "Technical Review"
})

// Parallel gateway (join)
const join = add-bpmn-gateway({
  x: 600, y: 185,
  type: "parallel"
})

// Final task
const finalize = add-bpmn-task({
  x: 700, y: 170,
  text: "Finalize Document"
})

// End
const end = add-bpmn-event({
  x: 850, y: 200,
  symbol: "general",
  position: "end"
})

// Flows
add-bpmn-flow({ sourceId: start.id, targetId: prepare.id, type: "sequence" })
add-bpmn-flow({ sourceId: prepare.id, targetId: fork.id, type: "sequence" })
add-bpmn-flow({ sourceId: fork.id, targetId: legal.id, type: "sequence" })
add-bpmn-flow({ sourceId: fork.id, targetId: finance.id, type: "sequence" })
add-bpmn-flow({ sourceId: fork.id, targetId: tech.id, type: "sequence" })
add-bpmn-flow({ sourceId: legal.id, targetId: join.id, type: "sequence" })
add-bpmn-flow({ sourceId: finance.id, targetId: join.id, type: "sequence" })
add-bpmn-flow({ sourceId: tech.id, targetId: join.id, type: "sequence" })
add-bpmn-flow({ sourceId: join.id, targetId: finalize.id, type: "sequence" })
add-bpmn-flow({ sourceId: finalize.id, targetId: end.id, type: "sequence" })
```

### Example 4: Error Handling with Boundary Events

```typescript
// Main task
const processPayment = add-bpmn-task({
  x: 200, y: 150,
  width: 120,
  height: 80,
  marker: "service",
  text: "Process Payment"
})

// Error boundary event
const errorHandler = add-bpmn-event({
  x: 305, y: 215,  // Bottom-right of task
  width: 30,
  height: 30,
  symbol: "error",
  position: "boundary",
  interrupting: true
})

// Timeout boundary event
const timeoutHandler = add-bpmn-event({
  x: 185, y: 215,  // Bottom-left of task
  width: 30,
  height: 30,
  symbol: "timer",
  position: "boundary",
  interrupting: true
})

// Error compensation task
const handleError = add-bpmn-task({
  x: 350, y: 250,
  marker: "service",
  text: "Refund Payment"
})

// Timeout compensation task
const handleTimeout = add-bpmn-task({
  x: 100, y: 250,
  marker: "service",
  text: "Retry Payment"
})

// Connect boundary events
add-bpmn-flow({
  sourceId: errorHandler.id,
  targetId: handleError.id,
  type: "sequence"
})

add-bpmn-flow({
  sourceId: timeoutHandler.id,
  targetId: handleTimeout.id,
  type: "sequence"
})
```

---

## Best Practices

1. **Use Meaningful Labels**: Always provide clear, descriptive text for activities and events
2. **Follow BPMN Standards**: Use the correct element types for their intended purpose
3. **Organize with Swimlanes**: Use pools and lanes to clearly show participant responsibilities
4. **Handle Exceptions**: Add boundary events for error handling and timeouts
5. **Document with Annotations**: Use text annotations to explain complex logic
6. **Group Related Elements**: Use groups to visually organize related process parts
7. **Use Data Objects**: Show important data artifacts flowing through the process
8. **Choose Appropriate Gateways**:
   - Exclusive for XOR decisions
   - Parallel for concurrent execution
   - Inclusive for OR conditions

---

## Reference

For complete technical details, see:
- `BPMN_CATALOG.md` - Complete catalog of all 59 event types and BPMN elements
- `src/bpmn/constants.ts` - All BPMN constants and type definitions
- `src/bpmn/styleBuilder.ts` - Style generation implementation
- `src/bpmn/schemas.ts` - Zod validation schemas

---

## Troubleshooting

### Element Not Rendering Correctly
- Verify all required parameters are provided
- Check that symbol/type values match the enums exactly
- Ensure IDs are correct when creating flows

### Boundary Events Not Attaching
- Position boundary events on the border of the task
- Typical positions: bottom-left, bottom-right corners
- Adjust x/y coordinates to align with task borders

### Swimlanes Not Organizing Elements
- Ensure lanes have correct parentId pointing to pool
- Verify element positions are within lane boundaries
- Check that lane coordinates and dimensions don't overlap incorrectly

### Flows Not Connecting
- Verify sourceId and targetId are valid cell IDs
- Ensure both elements exist before creating the flow
- Check that flow type is appropriate for the connection

---

*For support and questions, please refer to the main project documentation.*
