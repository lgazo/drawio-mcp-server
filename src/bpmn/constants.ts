/**
 * BPMN 2.0 Constants for draw.io MCP Server
 *
 * This module defines all BPMN element types, symbols, and default configurations
 * based on the mxGraph BPMN library conventions used by draw.io.
 */

// Event outline types
export const EventOutline = {
  STANDARD: 'standard',          // Single thin circle (Start, Intermediate Catching)
  EVENT_NONINT: 'eventNonint',  // Double thin circle (Non-Interrupting)
  THROWING: 'throwing',          // Double thin circle with fill (Intermediate Throwing)
  CATCHING: 'catching',          // Double thin circle (Intermediate Catching)
  END: 'end',                    // Single thick circle (End Events)
} as const;

export type EventOutlineType = typeof EventOutline[keyof typeof EventOutline];

// Event symbol types
export const EventSymbol = {
  GENERAL: 'general',                 // No symbol (None)
  MESSAGE: 'message',                 // Envelope icon
  TIMER: 'timer',                     // Clock icon
  ESCALATION: 'escalation',           // Upward arrow
  CONDITIONAL: 'conditional',         // Document with lines
  LINK: 'link',                       // Arrow
  ERROR: 'error',                     // Lightning bolt
  CANCEL: 'cancel',                   // X mark
  COMPENSATION: 'compensation',       // Rewind arrows
  SIGNAL: 'signal',                   // Triangle
  MULTIPLE: 'multiple',               // Pentagon
  PARALLEL_MULTIPLE: 'parallelMultiple', // Plus sign in pentagon
  TERMINATE: 'terminate',             // Filled circle
} as const;

export type EventSymbolType = typeof EventSymbol[keyof typeof EventSymbol];

// Event position types
export const EventPosition = {
  START: 'start',
  INTERMEDIATE: 'intermediate',
  END: 'end',
  BOUNDARY: 'boundary',
} as const;

export type EventPositionType = typeof EventPosition[keyof typeof EventPosition];

// Task marker types
export const TaskMarker = {
  NONE: undefined,               // Generic Task (no marker)
  USER: 'user',                  // User Task
  MANUAL: 'manual',              // Manual Task
  SEND: 'send',                  // Send Task
  RECEIVE: 'receive',            // Receive Task
  SERVICE: 'service',            // Service Task
  BUSINESS_RULE: 'businessRule', // Business Rule Task
  SCRIPT: 'script',              // Script Task
} as const;

export type TaskMarkerType = typeof TaskMarker[keyof typeof TaskMarker];

// Gateway types
export const GatewayType = {
  EXCLUSIVE: 'exclusive',                     // XOR - X marker
  PARALLEL: 'parallel',                       // AND - Plus marker
  INCLUSIVE: 'inclusive',                     // OR - Circle marker
  EVENT_BASED: 'eventBased',                  // Pentagon/double circle
  COMPLEX: 'complex',                         // Asterisk marker
  EXCLUSIVE_EVENT_BASED: 'exclusiveEventBased', // Exclusive Event-Based
  PARALLEL_EVENT_BASED: 'parallelEventBased',   // Parallel Event-Based
} as const;

export type GatewayTypeType = typeof GatewayType[keyof typeof GatewayType];

// Swimlane types
export const SwimlaneType = {
  POOL: 'pool',
  LANE: 'lane',
} as const;

export type SwimlaneTypeType = typeof SwimlaneType[keyof typeof SwimlaneType];

// Flow types
export const FlowType = {
  SEQUENCE: 'sequence',
  MESSAGE: 'message',
  ASSOCIATION: 'association',
  DATA_ASSOCIATION: 'dataAssociation',
} as const;

export type FlowTypeType = typeof FlowType[keyof typeof FlowType];

// Sequence flow types
export const SequenceFlowType = {
  NORMAL: 'normal',
  CONDITIONAL: 'conditional',
  DEFAULT: 'default',
} as const;

export type SequenceFlowTypeType = typeof SequenceFlowType[keyof typeof SequenceFlowType];

// Association direction
export const AssociationDirection = {
  NONE: 'none',
  ONE: 'one',
  BOTH: 'both',
} as const;

export type AssociationDirectionType = typeof AssociationDirection[keyof typeof AssociationDirection];

// Data object types
export const DataObjectType = {
  DATA_OBJECT: 'dataObject',
  DATA_INPUT: 'dataInput',
  DATA_OUTPUT: 'dataOutput',
  DATA_STORE: 'dataStore',
} as const;

export type DataObjectTypeType = typeof DataObjectType[keyof typeof DataObjectType];

// Default dimensions for BPMN shapes
export const BPMN_DIMENSIONS = {
  event: { width: 30, height: 30 },
  task: { width: 100, height: 80 },
  gateway: { width: 50, height: 50 },
  pool: { width: 600, height: 300 },
  lane: { width: 600, height: 100 },
  dataObject: { width: 36, height: 50 },
  dataStore: { width: 60, height: 60 },
  textAnnotation: { width: 100, height: 70 },
  group: { width: 200, height: 150 },
} as const;

// Common style properties
export const BPMN_COMMON_STYLES = {
  html: '1',
  verticalLabelPosition: 'bottom',
  labelBackgroundColor: '#ffffff',
  verticalAlign: 'top',
  align: 'center',
  strokeColor: '#000000',
  fillColor: '#ffffff',
} as const;

// Event connection points (ellipse perimeter)
export const EVENT_CONNECTION_POINTS = [
  [0.145, 0.145, 0],
  [0.5, 0, 0],
  [0.855, 0.145, 0],
  [1, 0.5, 0],
  [0.855, 0.855, 0],
  [0.5, 1, 0],
  [0.145, 0.855, 0],
  [0, 0.5, 0],
];

// Color constants
export const BPMN_COLORS = {
  BLACK: '#000000',
  WHITE: '#ffffff',
  LIGHT_YELLOW: '#FFFFCC',
} as const;

// Shape base names
export const BPMN_SHAPES = {
  EVENT: 'mxgraph.bpmn.event',
  TASK: 'mxgraph.bpmn.task',
  GATEWAY: 'mxgraph.bpmn.gateway',
  SUB_PROCESS: 'mxgraph.bpmn.subProcess',
  DATA_OBJECT: 'note',
  DATA_STORE: 'datastore',
  TEXT_ANNOTATION: 'note',
  GROUP: 'rect',
  SWIMLANE: 'swimlane',
  CONNECTOR: 'connector',
} as const;
