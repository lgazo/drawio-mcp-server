/**
 * BPMN Style Builder for draw.io MCP Server
 *
 * This module provides utilities to generate mxGraph style strings for BPMN 2.0 elements.
 */

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
  BPMN_COMMON_STYLES,
  BPMN_SHAPES,
  BPMN_COLORS,
  EVENT_CONNECTION_POINTS,
  type EventOutlineType,
  type EventSymbolType,
  type EventPositionType,
  type TaskMarkerType,
  type GatewayTypeType,
  type SwimlaneTypeType,
  type FlowTypeType,
  type SequenceFlowTypeType,
  type AssociationDirectionType,
  type DataObjectTypeType,
} from './constants.js';

/**
 * Options for building an event style
 */
export interface EventStyleOptions {
  symbol: EventSymbolType;
  position: EventPositionType;
  interrupting?: boolean;
  throwing?: boolean;
}

/**
 * Options for building a task style
 */
export interface TaskStyleOptions {
  marker?: TaskMarkerType;
  isLoopStandard?: boolean;
  isLoopMultiSeq?: boolean;
  isLoopMultiPar?: boolean;
  isAdHoc?: boolean;
  isCompensation?: boolean;
  isSubProcess?: boolean;
  isCallActivity?: boolean;
}

/**
 * Options for building a gateway style
 */
export interface GatewayStyleOptions {
  type: GatewayTypeType;
  instantiate?: boolean;
}

/**
 * Options for building a swimlane style
 */
export interface SwimlaneStyleOptions {
  type: SwimlaneTypeType;
  horizontal?: boolean;
}

/**
 * Options for building a flow style
 */
export interface FlowStyleOptions {
  type: FlowTypeType;
  sequenceFlowType?: SequenceFlowTypeType;
  associationDirection?: AssociationDirectionType;
  bidirectional?: boolean;
}

/**
 * Options for building a data object style
 */
export interface DataObjectStyleOptions {
  type: DataObjectTypeType;
  isCollection?: boolean;
}

/**
 * BPMN Style Builder class
 */
export class BpmnStyleBuilder {
  /**
   * Convert a style object to a semicolon-separated string
   */
  private static styleToString(styleObj: Record<string, string | number | boolean | undefined>): string {
    return Object.entries(styleObj)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${value}`)
      .join(';') + ';';
  }

  /**
   * Get the outline type for an event based on position, interrupting, and throwing flags
   */
  private static getEventOutline(
    position: EventPositionType,
    interrupting: boolean,
    throwing: boolean
  ): EventOutlineType {
    if (position === EventPosition.END) {
      return EventOutline.END;
    }

    if (position === EventPosition.BOUNDARY || position === EventPosition.START) {
      return interrupting ? EventOutline.STANDARD : EventOutline.EVENT_NONINT;
    }

    // Intermediate events
    return throwing ? EventOutline.THROWING : EventOutline.CATCHING;
  }

  /**
   * Build an event style string
   */
  static buildEventStyle(options: EventStyleOptions): string {
    const {
      symbol,
      position,
      interrupting = true,
      throwing = false,
    } = options;

    const outline = this.getEventOutline(position, interrupting, throwing);
    const isBoundary = position === EventPosition.BOUNDARY;
    const isEnd = position === EventPosition.END;

    const styleObj: Record<string, string | number> = {
      points: `[[${EVENT_CONNECTION_POINTS.map((p: number[]) => p.join(',')).join('],[') }]]`,
      shape: BPMN_SHAPES.EVENT,
      html: BPMN_COMMON_STYLES.html,
      verticalLabelPosition: BPMN_COMMON_STYLES.verticalLabelPosition,
      labelBackgroundColor: BPMN_COMMON_STYLES.labelBackgroundColor,
      verticalAlign: BPMN_COMMON_STYLES.verticalAlign,
      align: BPMN_COMMON_STYLES.align,
      perimeter: 'ellipsePerimeter',
      outlineConnect: 0,
      aspect: 'fixed',
      outline,
      symbol,
    };

    // Add dashed line for non-interrupting events
    if (!interrupting && (position === EventPosition.START || isBoundary)) {
      styleObj.dashed = 1;
    }

    // Add eventType for boundary events
    if (isBoundary) {
      styleObj.eventType = 'boundary';
    }

    // Add black fill for end events (except None and Terminate)
    if (isEnd && symbol !== EventSymbol.GENERAL && symbol !== EventSymbol.TERMINATE) {
      styleObj.fillColor = BPMN_COLORS.BLACK;
    }

    // Terminate end event has special fill
    if (isEnd && symbol === EventSymbol.TERMINATE) {
      styleObj.fillColor = BPMN_COLORS.BLACK;
    }

    return this.styleToString(styleObj);
  }

  /**
   * Build a task style string
   */
  static buildTaskStyle(options: TaskStyleOptions = {}): string {
    const {
      marker,
      isLoopStandard = false,
      isLoopMultiSeq = false,
      isLoopMultiPar = false,
      isAdHoc = false,
      isCompensation = false,
      isSubProcess = false,
      isCallActivity = false,
    } = options;

    const styleObj: Record<string, string | number> = {
      shape: isSubProcess && !isCallActivity ? BPMN_SHAPES.SUB_PROCESS : BPMN_SHAPES.TASK,
      whiteSpace: 'wrap',
      html: BPMN_COMMON_STYLES.html,
    };

    // Add task marker if specified
    if (marker) {
      styleObj.taskMarker = marker;
    }

    // Add loop indicators
    if (isLoopStandard) {
      styleObj.isLoopStandard = 1;
    }
    if (isLoopMultiSeq) {
      styleObj.isLoopMultiSeq = 1;
    }
    if (isLoopMultiPar) {
      styleObj.isLoopMultiPar = 1;
    }
    if (isAdHoc) {
      styleObj.isAdHoc = 1;
    }
    if (isCompensation) {
      styleObj.isCompensation = 1;
    }

    // Add subprocess indicator
    if (isSubProcess && !isCallActivity) {
      styleObj.isSubProcess = 1;
    }

    // Call activity has thick border
    if (isCallActivity) {
      styleObj.strokeWidth = 3;
    }

    // Subprocess with thick border
    if (isSubProcess && !isCallActivity) {
      styleObj.strokeWidth = 2;
    }

    return this.styleToString(styleObj);
  }

  /**
   * Build a gateway style string
   */
  static buildGatewayStyle(options: GatewayStyleOptions): string {
    const { type, instantiate = false } = options;

    const styleObj: Record<string, string | number> = {
      shape: BPMN_SHAPES.GATEWAY,
      perimeter: 'rhombusPerimeter',
      html: BPMN_COMMON_STYLES.html,
      verticalLabelPosition: BPMN_COMMON_STYLES.verticalLabelPosition,
      labelBackgroundColor: BPMN_COMMON_STYLES.labelBackgroundColor,
      verticalAlign: BPMN_COMMON_STYLES.verticalAlign,
      gatewayType: type,
    };

    // Exclusive event-based gateway
    if (type === GatewayType.EVENT_BASED && instantiate) {
      styleObj.instantiate = 1;
    }

    return this.styleToString(styleObj);
  }

  /**
   * Build a swimlane style string (Pool or Lane)
   */
  static buildSwimlaneStyle(options: SwimlaneStyleOptions): string {
    const { type, horizontal = true } = options;

    const isPool = type === SwimlaneType.POOL;

    const styleObj: Record<string, string | number> = {
      shape: BPMN_SHAPES.SWIMLANE,
      horizontal: horizontal ? 1 : 0,
      startSize: 20,
      bpmnShapeType: type,
      html: BPMN_COMMON_STYLES.html,
    };

    // Lanes have white fill
    if (!isPool) {
      styleObj.swimlaneFillColor = 'white';
      styleObj.collapsible = 0;
    }

    return this.styleToString(styleObj);
  }

  /**
   * Build a flow style string (Sequence, Message, Association, or Data Association)
   */
  static buildFlowStyle(options: FlowStyleOptions): string {
    const {
      type,
      sequenceFlowType = SequenceFlowType.NORMAL,
      associationDirection = AssociationDirection.NONE,
      bidirectional = false,
    } = options;

    const baseStyle: Record<string, string | number> = {
      shape: BPMN_SHAPES.CONNECTOR,
      rounded: 0,
      html: BPMN_COMMON_STYLES.html,
      jettySize: 'auto',
      orthogonalLoop: 1,
      strokeColor: BPMN_COLORS.BLACK,
    };

    // Sequence Flow
    if (type === FlowType.SEQUENCE) {
      baseStyle.endArrow = 'block';

      // Conditional flow has diamond at source
      if (sequenceFlowType === SequenceFlowType.CONDITIONAL) {
        baseStyle.sourceMarker = 'diamond';
      }

      // Default flow has dash at source
      if (sequenceFlowType === SequenceFlowType.DEFAULT) {
        baseStyle.startArrow = 'dash';
      }
    }

    // Message Flow
    if (type === FlowType.MESSAGE) {
      baseStyle.dashed = 1;
      baseStyle.dashPattern = '8 4';
      baseStyle.endArrow = 'open';

      if (bidirectional) {
        baseStyle.startArrow = 'open';
      } else {
        baseStyle.startArrow = 'none';
      }
    }

    // Association
    if (type === FlowType.ASSOCIATION) {
      baseStyle.dashed = 1;
      baseStyle.dashPattern = '1 2';

      if (associationDirection === AssociationDirection.NONE) {
        baseStyle.endArrow = 'none';
      } else if (associationDirection === AssociationDirection.ONE) {
        baseStyle.endArrow = 'open';
      } else if (associationDirection === AssociationDirection.BOTH) {
        baseStyle.startArrow = 'open';
        baseStyle.endArrow = 'open';
      }
    }

    // Data Association
    if (type === FlowType.DATA_ASSOCIATION) {
      baseStyle.dashed = 1;
      baseStyle.dashPattern = '1 2';
      baseStyle.endArrow = 'block';
    }

    return this.styleToString(baseStyle);
  }

  /**
   * Build a data object style string
   */
  static buildDataObjectStyle(options: DataObjectStyleOptions): string {
    const { type, isCollection = false } = options;

    const isStore = type === DataObjectType.DATA_STORE;

    const styleObj: Record<string, string | number> = {
      shape: isStore ? BPMN_SHAPES.DATA_STORE : BPMN_SHAPES.DATA_OBJECT,
      html: BPMN_COMMON_STYLES.html,
      bpmnObjectType: type,
    };

    if (!isStore) {
      styleObj.size = 15;
      styleObj.whiteSpace = 'wrap';
    }

    if (isStore) {
      styleObj.labelPosition = 'center';
      styleObj.verticalLabelPosition = 'bottom';
      styleObj.align = 'center';
      styleObj.verticalAlign = 'top';
    }

    // Collection indicator
    if (isCollection && !isStore) {
      styleObj.isCollection = 1;
    }

    return this.styleToString(styleObj);
  }

  /**
   * Build a text annotation style string
   */
  static buildTextAnnotationStyle(): string {
    const styleObj: Record<string, string | number> = {
      shape: BPMN_SHAPES.TEXT_ANNOTATION,
      size: 20,
      align: 'left',
      html: BPMN_COMMON_STYLES.html,
      fillColor: BPMN_COLORS.LIGHT_YELLOW,
      strokeWidth: 1,
    };

    return this.styleToString(styleObj);
  }

  /**
   * Build a group style string
   */
  static buildGroupStyle(): string {
    const styleObj: Record<string, string | number> = {
      shape: BPMN_SHAPES.GROUP,
      dashed: 1,
      dashPattern: '2 3',
      strokeWidth: 2,
      fillColor: 'none',
      rounded: 1,
    };

    return this.styleToString(styleObj);
  }
}
