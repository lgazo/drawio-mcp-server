/**
 * BPMN Zod Schemas for draw.io MCP Server
 *
 * This module provides Zod validation schemas for BPMN tool parameters.
 */

import { z } from 'zod';
import {
  EventOutline,
  EventSymbol,
  EventPosition,
  TaskMarker,
  GatewayType,
  SwimlaneType,
  FlowType,
  SequenceFlowType,
  AssociationDirection,
  DataObjectType,
} from './constants.js';

// Base coordinate schema
const coordinateSchema = z.number().optional().default(100);
const dimensionSchema = z.number().optional();

// Event schemas
export const eventOutlineSchema = z.enum([
  EventOutline.STANDARD,
  EventOutline.EVENT_NONINT,
  EventOutline.THROWING,
  EventOutline.CATCHING,
  EventOutline.END,
]);

export const eventSymbolSchema = z.enum([
  EventSymbol.GENERAL,
  EventSymbol.MESSAGE,
  EventSymbol.TIMER,
  EventSymbol.ESCALATION,
  EventSymbol.CONDITIONAL,
  EventSymbol.LINK,
  EventSymbol.ERROR,
  EventSymbol.CANCEL,
  EventSymbol.COMPENSATION,
  EventSymbol.SIGNAL,
  EventSymbol.MULTIPLE,
  EventSymbol.PARALLEL_MULTIPLE,
  EventSymbol.TERMINATE,
]);

export const eventPositionSchema = z.enum([
  EventPosition.START,
  EventPosition.INTERMEDIATE,
  EventPosition.END,
  EventPosition.BOUNDARY,
]);

/**
 * Schema for adding a BPMN event
 */
export const addBpmnEventSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
  width: dimensionSchema,
  height: dimensionSchema,
  text: z.string().optional().default(''),
  symbol: eventSymbolSchema.describe('The event symbol type (e.g., message, timer, error)'),
  position: eventPositionSchema.describe('The event position (start, intermediate, end, boundary)'),
  interrupting: z.boolean().optional().default(true).describe('Whether the event is interrupting (for start and boundary events)'),
  throwing: z.boolean().optional().default(false).describe('Whether the event is throwing (for intermediate events)'),
  style: z.string().optional().describe('Additional custom style properties'),
});

export type AddBpmnEventInput = z.infer<typeof addBpmnEventSchema>;

// Task schemas
export const taskMarkerSchema = z.enum([
  'user',
  'manual',
  'send',
  'receive',
  'service',
  'businessRule',
  'script',
]).optional();

/**
 * Schema for adding a BPMN task
 */
export const addBpmnTaskSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
  width: dimensionSchema,
  height: dimensionSchema,
  text: z.string().optional().default('Task'),
  marker: taskMarkerSchema.describe('The task marker type (user, service, manual, etc.)'),
  isLoopStandard: z.boolean().optional().default(false).describe('Standard loop indicator'),
  isLoopMultiSeq: z.boolean().optional().default(false).describe('Multi-instance sequential loop'),
  isLoopMultiPar: z.boolean().optional().default(false).describe('Multi-instance parallel loop'),
  isAdHoc: z.boolean().optional().default(false).describe('Ad-hoc marker'),
  isCompensation: z.boolean().optional().default(false).describe('Compensation marker'),
  isSubProcess: z.boolean().optional().default(false).describe('Whether this is a subprocess'),
  isCallActivity: z.boolean().optional().default(false).describe('Whether this is a call activity'),
  style: z.string().optional().describe('Additional custom style properties'),
});

export type AddBpmnTaskInput = z.infer<typeof addBpmnTaskSchema>;

// Gateway schemas
export const gatewayTypeSchema = z.enum([
  GatewayType.EXCLUSIVE,
  GatewayType.PARALLEL,
  GatewayType.INCLUSIVE,
  GatewayType.EVENT_BASED,
  GatewayType.COMPLEX,
  GatewayType.EXCLUSIVE_EVENT_BASED,
  GatewayType.PARALLEL_EVENT_BASED,
]);

/**
 * Schema for adding a BPMN gateway
 */
export const addBpmnGatewaySchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
  width: dimensionSchema,
  height: dimensionSchema,
  text: z.string().optional().default(''),
  type: gatewayTypeSchema.describe('The gateway type (exclusive, parallel, inclusive, etc.)'),
  instantiate: z.boolean().optional().default(false).describe('Instantiate marker for event-based gateways'),
  style: z.string().optional().describe('Additional custom style properties'),
});

export type AddBpmnGatewayInput = z.infer<typeof addBpmnGatewaySchema>;

// Swimlane schemas
export const swimlaneTypeSchema = z.enum([
  SwimlaneType.POOL,
  SwimlaneType.LANE,
]);

/**
 * Schema for adding a BPMN swimlane (pool or lane)
 */
export const addBpmnSwimlaneSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
  width: dimensionSchema,
  height: dimensionSchema,
  text: z.string().optional().default('Pool'),
  type: swimlaneTypeSchema.describe('The swimlane type (pool or lane)'),
  horizontal: z.boolean().optional().default(true).describe('Whether the swimlane is horizontal'),
  parentId: z.string().optional().describe('Parent pool ID for lanes'),
  style: z.string().optional().describe('Additional custom style properties'),
});

export type AddBpmnSwimlaneInput = z.infer<typeof addBpmnSwimlaneSchema>;

// Flow schemas
export const flowTypeSchema = z.enum([
  FlowType.SEQUENCE,
  FlowType.MESSAGE,
  FlowType.ASSOCIATION,
  FlowType.DATA_ASSOCIATION,
]);

export const sequenceFlowTypeSchema = z.enum([
  SequenceFlowType.NORMAL,
  SequenceFlowType.CONDITIONAL,
  SequenceFlowType.DEFAULT,
]).optional().default(SequenceFlowType.NORMAL);

export const associationDirectionSchema = z.enum([
  AssociationDirection.NONE,
  AssociationDirection.ONE,
  AssociationDirection.BOTH,
]).optional().default(AssociationDirection.NONE);

/**
 * Schema for adding a BPMN flow (sequence, message, association)
 */
export const addBpmnFlowSchema = z.object({
  sourceId: z.string().describe('Source cell ID'),
  targetId: z.string().describe('Target cell ID'),
  text: z.string().optional().default(''),
  type: flowTypeSchema.describe('The flow type (sequence, message, association, dataAssociation)'),
  sequenceFlowType: sequenceFlowTypeSchema.describe('Sequence flow subtype (normal, conditional, default)'),
  associationDirection: associationDirectionSchema.describe('Association direction (none, one, both)'),
  bidirectional: z.boolean().optional().default(false).describe('Bidirectional message flow'),
  style: z.string().optional().describe('Additional custom style properties'),
});

export type AddBpmnFlowInput = z.infer<typeof addBpmnFlowSchema>;

// Data object schemas
export const dataObjectTypeSchema = z.enum([
  DataObjectType.DATA_OBJECT,
  DataObjectType.DATA_INPUT,
  DataObjectType.DATA_OUTPUT,
  DataObjectType.DATA_STORE,
]);

/**
 * Schema for adding a BPMN data object
 */
export const addBpmnDataObjectSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
  width: dimensionSchema,
  height: dimensionSchema,
  text: z.string().optional().default('Data'),
  type: dataObjectTypeSchema.describe('The data object type'),
  isCollection: z.boolean().optional().default(false).describe('Collection indicator'),
  style: z.string().optional().describe('Additional custom style properties'),
});

export type AddBpmnDataObjectInput = z.infer<typeof addBpmnDataObjectSchema>;

/**
 * Schema for adding a BPMN text annotation
 */
export const addBpmnTextAnnotationSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
  width: dimensionSchema,
  height: dimensionSchema,
  text: z.string().optional().default('Annotation'),
  style: z.string().optional().describe('Additional custom style properties'),
});

export type AddBpmnTextAnnotationInput = z.infer<typeof addBpmnTextAnnotationSchema>;

/**
 * Schema for adding a BPMN group
 */
export const addBpmnGroupSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
  width: dimensionSchema,
  height: dimensionSchema,
  text: z.string().optional().default(''),
  style: z.string().optional().describe('Additional custom style properties'),
});

export type AddBpmnGroupInput = z.infer<typeof addBpmnGroupSchema>;

// Export all schemas for tool registration
// Use .shape to get the raw ZodRawShape that server.tool() expects
export const bpmnSchemas = {
  addBpmnEvent: addBpmnEventSchema.shape,
  addBpmnTask: addBpmnTaskSchema.shape,
  addBpmnGateway: addBpmnGatewaySchema.shape,
  addBpmnSwimlane: addBpmnSwimlaneSchema.shape,
  addBpmnFlow: addBpmnFlowSchema.shape,
  addBpmnDataObject: addBpmnDataObjectSchema.shape,
  addBpmnTextAnnotation: addBpmnTextAnnotationSchema.shape,
  addBpmnGroup: addBpmnGroupSchema.shape,
} as const;
