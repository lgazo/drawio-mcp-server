/**
 * BPMN 2.0 Tools for draw.io MCP Server
 *
 * This module registers all BPMN tools with the MCP server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Context } from "./types.js";
import { build_channel } from "./tool.js";
import {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

import {
  BpmnStyleBuilder,
  bpmnSchemas,
  BPMN_DIMENSIONS,
  type AddBpmnEventInput,
  type AddBpmnTaskInput,
  type AddBpmnGatewayInput,
  type AddBpmnSwimlaneInput,
  type AddBpmnFlowInput,
  type AddBpmnDataObjectInput,
  type AddBpmnTextAnnotationInput,
  type AddBpmnGroupInput,
} from './bpmn/index.js';

/**
 * Register all BPMN tools with the MCP server
 */
export function registerBpmnTools(server: McpServer, context: Context) {
  const addRectangleTool = build_channel(context, "add-rectangle", (reply) => ({
    content: [{ type: "text", text: JSON.stringify(reply) }],
  }));

  const addEdgeTool = build_channel(context, "add-edge", (reply) => ({
    content: [{ type: "text", text: JSON.stringify(reply) }],
  }));

  // ========================================
  // BPMN Event Tools
  // ========================================

  const TOOL_add_bpmn_event = "add-bpmn-event";
  server.tool(
    TOOL_add_bpmn_event,
    "Add a BPMN event to the diagram. Events represent things that happen during a process (start, intermediate, end, or boundary events) with various triggers (message, timer, error, etc.).",
    bpmnSchemas.addBpmnEvent.shape,
    async (params: AddBpmnEventInput, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      // Generate BPMN event style
      const bpmnStyle = BpmnStyleBuilder.buildEventStyle({
        symbol: params.symbol,
        position: params.position,
        interrupting: params.interrupting ?? true,
        throwing: params.throwing ?? false,
      });

      // Use default dimensions if not provided
      const width = params.width ?? BPMN_DIMENSIONS.event.width;
      const height = params.height ?? BPMN_DIMENSIONS.event.height;

      // Combine custom style if provided
      const finalStyle = params.style ? `${bpmnStyle}${params.style}` : bpmnStyle;

      // Call add-rectangle with transformed parameters
      return addRectangleTool({
        x: params.x,
        y: params.y,
        width,
        height,
        text: params.text ?? '',
        style: finalStyle,
      }, extra);
    }
  );

  // ========================================
  // BPMN Task Tools
  // ========================================

  const TOOL_add_bpmn_task = "add-bpmn-task";
  server.tool(
    TOOL_add_bpmn_task,
    "Add a BPMN task or activity to the diagram. Tasks represent work to be performed, with optional markers for task type (user, service, manual, etc.) and loop indicators.",
    bpmnSchemas.addBpmnTask.shape,
    async (params: AddBpmnTaskInput, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      // Generate BPMN task style
      const bpmnStyle = BpmnStyleBuilder.buildTaskStyle({
        marker: params.marker,
        isLoopStandard: params.isLoopStandard ?? false,
        isLoopMultiSeq: params.isLoopMultiSeq ?? false,
        isLoopMultiPar: params.isLoopMultiPar ?? false,
        isAdHoc: params.isAdHoc ?? false,
        isCompensation: params.isCompensation ?? false,
        isSubProcess: params.isSubProcess ?? false,
        isCallActivity: params.isCallActivity ?? false,
      });

      // Use default dimensions if not provided
      const width = params.width ?? BPMN_DIMENSIONS.task.width;
      const height = params.height ?? BPMN_DIMENSIONS.task.height;

      // Combine custom style if provided
      const finalStyle = params.style ? `${bpmnStyle}${params.style}` : bpmnStyle;

      // Call add-rectangle with transformed parameters
      return addRectangleTool({
        x: params.x,
        y: params.y,
        width,
        height,
        text: params.text ?? 'Task',
        style: finalStyle,
      }, extra);
    }
  );

  // ========================================
  // BPMN Gateway Tools
  // ========================================

  const TOOL_add_bpmn_gateway = "add-bpmn-gateway";
  server.tool(
    TOOL_add_bpmn_gateway,
    "Add a BPMN gateway to the diagram. Gateways control the flow of a process, representing decisions (exclusive), parallelization (parallel), or event-based routing.",
    bpmnSchemas.addBpmnGateway.shape,
    async (params: AddBpmnGatewayInput, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      // Generate BPMN gateway style
      const bpmnStyle = BpmnStyleBuilder.buildGatewayStyle({
        type: params.type,
        instantiate: params.instantiate ?? false,
      });

      // Use default dimensions if not provided
      const width = params.width ?? BPMN_DIMENSIONS.gateway.width;
      const height = params.height ?? BPMN_DIMENSIONS.gateway.height;

      // Combine custom style if provided
      const finalStyle = params.style ? `${bpmnStyle}${params.style}` : bpmnStyle;

      // Call add-rectangle with transformed parameters
      return addRectangleTool({
        x: params.x,
        y: params.y,
        width,
        height,
        text: params.text ?? '',
        style: finalStyle,
      }, extra);
    }
  );

  // ========================================
  // BPMN Swimlane Tools
  // ========================================

  const TOOL_add_bpmn_swimlane = "add-bpmn-swimlane";
  server.tool(
    TOOL_add_bpmn_swimlane,
    "Add a BPMN swimlane (pool or lane) to the diagram. Pools represent participants in a process, and lanes subdivide pools by role or responsibility.",
    bpmnSchemas.addBpmnSwimlane.shape,
    async (params: AddBpmnSwimlaneInput, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      // Generate BPMN swimlane style
      const bpmnStyle = BpmnStyleBuilder.buildSwimlaneStyle({
        type: params.type,
        horizontal: params.horizontal ?? true,
      });

      // Use default dimensions based on type
      const isPool = params.type === 'pool';
      const width = params.width ?? BPMN_DIMENSIONS[isPool ? 'pool' : 'lane'].width;
      const height = params.height ?? BPMN_DIMENSIONS[isPool ? 'pool' : 'lane'].height;

      // Combine custom style if provided
      const finalStyle = params.style ? `${bpmnStyle}${params.style}` : bpmnStyle;

      // Build rectangle params
      const rectParams: any = {
        x: params.x,
        y: params.y,
        width,
        height,
        text: params.text ?? (isPool ? 'Pool' : 'Lane'),
        style: finalStyle,
      };

      // Add parent if it's a lane
      if (!isPool && params.parentId) {
        rectParams.parentId = params.parentId;
      }

      // Call add-rectangle with transformed parameters
      return addRectangleTool(rectParams, extra);
    }
  );

  // ========================================
  // BPMN Flow Tools
  // ========================================

  const TOOL_add_bpmn_flow = "add-bpmn-flow";
  server.tool(
    TOOL_add_bpmn_flow,
    "Add a BPMN flow connector between elements. Flows can be sequence flows (within a pool), message flows (between pools), or associations (to artifacts).",
    bpmnSchemas.addBpmnFlow.shape,
    async (params: AddBpmnFlowInput, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      // Generate BPMN flow style
      const bpmnStyle = BpmnStyleBuilder.buildFlowStyle({
        type: params.type,
        sequenceFlowType: params.sequenceFlowType,
        associationDirection: params.associationDirection,
        bidirectional: params.bidirectional ?? false,
      });

      // Combine custom style if provided
      const finalStyle = params.style ? `${bpmnStyle}${params.style}` : bpmnStyle;

      // Call add-edge with transformed parameters
      return addEdgeTool({
        sourceId: params.sourceId,
        targetId: params.targetId,
        text: params.text ?? '',
        style: finalStyle,
      }, extra);
    }
  );

  // ========================================
  // BPMN Data Object Tools
  // ========================================

  const TOOL_add_bpmn_data_object = "add-bpmn-data-object";
  server.tool(
    TOOL_add_bpmn_data_object,
    "Add a BPMN data object to the diagram. Data objects represent information flowing through the process (data objects, data inputs, data outputs, or data stores).",
    bpmnSchemas.addBpmnDataObject.shape,
    async (params: AddBpmnDataObjectInput, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      // Generate BPMN data object style
      const bpmnStyle = BpmnStyleBuilder.buildDataObjectStyle({
        type: params.type,
        isCollection: params.isCollection ?? false,
      });

      // Use default dimensions based on type
      const isStore = params.type === 'dataStore';
      const width = params.width ?? BPMN_DIMENSIONS[isStore ? 'dataStore' : 'dataObject'].width;
      const height = params.height ?? BPMN_DIMENSIONS[isStore ? 'dataStore' : 'dataObject'].height;

      // Combine custom style if provided
      const finalStyle = params.style ? `${bpmnStyle}${params.style}` : bpmnStyle;

      // Call add-rectangle with transformed parameters
      return addRectangleTool({
        x: params.x,
        y: params.y,
        width,
        height,
        text: params.text ?? 'Data',
        style: finalStyle,
      }, extra);
    }
  );

  // ========================================
  // BPMN Artifact Tools
  // ========================================

  const TOOL_add_bpmn_text_annotation = "add-bpmn-text-annotation";
  server.tool(
    TOOL_add_bpmn_text_annotation,
    "Add a BPMN text annotation to the diagram. Text annotations provide additional information about the process without affecting the flow.",
    bpmnSchemas.addBpmnTextAnnotation.shape,
    async (params: AddBpmnTextAnnotationInput, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      // Generate BPMN text annotation style
      const bpmnStyle = BpmnStyleBuilder.buildTextAnnotationStyle();

      // Use default dimensions
      const width = params.width ?? BPMN_DIMENSIONS.textAnnotation.width;
      const height = params.height ?? BPMN_DIMENSIONS.textAnnotation.height;

      // Combine custom style if provided
      const finalStyle = params.style ? `${bpmnStyle}${params.style}` : bpmnStyle;

      // Call add-rectangle with transformed parameters
      return addRectangleTool({
        x: params.x,
        y: params.y,
        width,
        height,
        text: params.text ?? 'Annotation',
        style: finalStyle,
      }, extra);
    }
  );

  const TOOL_add_bpmn_group = "add-bpmn-group";
  server.tool(
    TOOL_add_bpmn_group,
    "Add a BPMN group to the diagram. Groups visually organize related elements without affecting the process flow.",
    bpmnSchemas.addBpmnGroup.shape,
    async (params: AddBpmnGroupInput, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      // Generate BPMN group style
      const bpmnStyle = BpmnStyleBuilder.buildGroupStyle();

      // Use default dimensions
      const width = params.width ?? BPMN_DIMENSIONS.group.width;
      const height = params.height ?? BPMN_DIMENSIONS.group.height;

      // Combine custom style if provided
      const finalStyle = params.style ? `${bpmnStyle}${params.style}` : bpmnStyle;

      // Call add-rectangle with transformed parameters
      return addRectangleTool({
        x: params.x,
        y: params.y,
        width,
        height,
        text: params.text ?? '',
        style: finalStyle,
      }, extra);
    }
  );
}
