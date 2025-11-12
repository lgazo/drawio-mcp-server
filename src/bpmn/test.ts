/**
 * BPMN Style Builder Test Script
 *
 * This script tests the BpmnStyleBuilder to ensure it generates correct style strings.
 */

import { BpmnStyleBuilder } from './styleBuilder.js';
import {
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

console.log('===== BPMN Style Builder Tests =====\n');

// Test 1: Event Styles
console.log('--- Event Styles ---\n');

console.log('1. None Start Event:');
const noneStartStyle = BpmnStyleBuilder.buildEventStyle({
  symbol: EventSymbol.GENERAL,
  position: EventPosition.START,
});
console.log(noneStartStyle);
console.log();

console.log('2. Message Start (Interrupting):');
const messageStartStyle = BpmnStyleBuilder.buildEventStyle({
  symbol: EventSymbol.MESSAGE,
  position: EventPosition.START,
  interrupting: true,
});
console.log(messageStartStyle);
console.log();

console.log('3. Timer Start (Non-Interrupting):');
const timerStartNonIntStyle = BpmnStyleBuilder.buildEventStyle({
  symbol: EventSymbol.TIMER,
  position: EventPosition.START,
  interrupting: false,
});
console.log(timerStartNonIntStyle);
console.log();

console.log('4. Message Intermediate (Catching):');
const messageIntCatchingStyle = BpmnStyleBuilder.buildEventStyle({
  symbol: EventSymbol.MESSAGE,
  position: EventPosition.INTERMEDIATE,
  throwing: false,
});
console.log(messageIntCatchingStyle);
console.log();

console.log('5. Message Intermediate (Throwing):');
const messageIntThrowingStyle = BpmnStyleBuilder.buildEventStyle({
  symbol: EventSymbol.MESSAGE,
  position: EventPosition.INTERMEDIATE,
  throwing: true,
});
console.log(messageIntThrowingStyle);
console.log();

console.log('6. Timer Boundary (Interrupting):');
const timerBoundaryIntStyle = BpmnStyleBuilder.buildEventStyle({
  symbol: EventSymbol.TIMER,
  position: EventPosition.BOUNDARY,
  interrupting: true,
});
console.log(timerBoundaryIntStyle);
console.log();

console.log('7. Message Boundary (Non-Interrupting):');
const messageBoundaryNonIntStyle = BpmnStyleBuilder.buildEventStyle({
  symbol: EventSymbol.MESSAGE,
  position: EventPosition.BOUNDARY,
  interrupting: false,
});
console.log(messageBoundaryNonIntStyle);
console.log();

console.log('8. None End Event:');
const noneEndStyle = BpmnStyleBuilder.buildEventStyle({
  symbol: EventSymbol.GENERAL,
  position: EventPosition.END,
});
console.log(noneEndStyle);
console.log();

console.log('9. Error End Event:');
const errorEndStyle = BpmnStyleBuilder.buildEventStyle({
  symbol: EventSymbol.ERROR,
  position: EventPosition.END,
});
console.log(errorEndStyle);
console.log();

console.log('10. Terminate End Event:');
const terminateEndStyle = BpmnStyleBuilder.buildEventStyle({
  symbol: EventSymbol.TERMINATE,
  position: EventPosition.END,
});
console.log(terminateEndStyle);
console.log();

// Test 2: Task Styles
console.log('\n--- Task Styles ---\n');

console.log('1. Generic Task:');
const genericTaskStyle = BpmnStyleBuilder.buildTaskStyle();
console.log(genericTaskStyle);
console.log();

console.log('2. User Task:');
const userTaskStyle = BpmnStyleBuilder.buildTaskStyle({
  marker: TaskMarker.USER,
});
console.log(userTaskStyle);
console.log();

console.log('3. Service Task:');
const serviceTaskStyle = BpmnStyleBuilder.buildTaskStyle({
  marker: TaskMarker.SERVICE,
});
console.log(serviceTaskStyle);
console.log();

console.log('4. User Task with Loop:');
const userTaskLoopStyle = BpmnStyleBuilder.buildTaskStyle({
  marker: TaskMarker.USER,
  isLoopStandard: true,
});
console.log(userTaskLoopStyle);
console.log();

console.log('5. Sub-Process:');
const subProcessStyle = BpmnStyleBuilder.buildTaskStyle({
  isSubProcess: true,
});
console.log(subProcessStyle);
console.log();

console.log('6. Call Activity:');
const callActivityStyle = BpmnStyleBuilder.buildTaskStyle({
  isCallActivity: true,
});
console.log(callActivityStyle);
console.log();

// Test 3: Gateway Styles
console.log('\n--- Gateway Styles ---\n');

console.log('1. Exclusive Gateway (XOR):');
const exclusiveGatewayStyle = BpmnStyleBuilder.buildGatewayStyle({
  type: GatewayType.EXCLUSIVE,
});
console.log(exclusiveGatewayStyle);
console.log();

console.log('2. Parallel Gateway (AND):');
const parallelGatewayStyle = BpmnStyleBuilder.buildGatewayStyle({
  type: GatewayType.PARALLEL,
});
console.log(parallelGatewayStyle);
console.log();

console.log('3. Inclusive Gateway (OR):');
const inclusiveGatewayStyle = BpmnStyleBuilder.buildGatewayStyle({
  type: GatewayType.INCLUSIVE,
});
console.log(inclusiveGatewayStyle);
console.log();

console.log('4. Event-Based Gateway:');
const eventBasedGatewayStyle = BpmnStyleBuilder.buildGatewayStyle({
  type: GatewayType.EVENT_BASED,
});
console.log(eventBasedGatewayStyle);
console.log();

// Test 4: Swimlane Styles
console.log('\n--- Swimlane Styles ---\n');

console.log('1. Horizontal Pool:');
const horizontalPoolStyle = BpmnStyleBuilder.buildSwimlaneStyle({
  type: SwimlaneType.POOL,
  horizontal: true,
});
console.log(horizontalPoolStyle);
console.log();

console.log('2. Vertical Pool:');
const verticalPoolStyle = BpmnStyleBuilder.buildSwimlaneStyle({
  type: SwimlaneType.POOL,
  horizontal: false,
});
console.log(verticalPoolStyle);
console.log();

console.log('3. Horizontal Lane:');
const horizontalLaneStyle = BpmnStyleBuilder.buildSwimlaneStyle({
  type: SwimlaneType.LANE,
  horizontal: true,
});
console.log(horizontalLaneStyle);
console.log();

// Test 5: Flow Styles
console.log('\n--- Flow Styles ---\n');

console.log('1. Sequence Flow (Normal):');
const normalSequenceFlowStyle = BpmnStyleBuilder.buildFlowStyle({
  type: FlowType.SEQUENCE,
  sequenceFlowType: SequenceFlowType.NORMAL,
});
console.log(normalSequenceFlowStyle);
console.log();

console.log('2. Sequence Flow (Conditional):');
const conditionalSequenceFlowStyle = BpmnStyleBuilder.buildFlowStyle({
  type: FlowType.SEQUENCE,
  sequenceFlowType: SequenceFlowType.CONDITIONAL,
});
console.log(conditionalSequenceFlowStyle);
console.log();

console.log('3. Sequence Flow (Default):');
const defaultSequenceFlowStyle = BpmnStyleBuilder.buildFlowStyle({
  type: FlowType.SEQUENCE,
  sequenceFlowType: SequenceFlowType.DEFAULT,
});
console.log(defaultSequenceFlowStyle);
console.log();

console.log('4. Message Flow:');
const messageFlowStyle = BpmnStyleBuilder.buildFlowStyle({
  type: FlowType.MESSAGE,
});
console.log(messageFlowStyle);
console.log();

console.log('5. Message Flow (Bidirectional):');
const bidirectionalMessageFlowStyle = BpmnStyleBuilder.buildFlowStyle({
  type: FlowType.MESSAGE,
  bidirectional: true,
});
console.log(bidirectionalMessageFlowStyle);
console.log();

console.log('6. Association (Undirected):');
const undirectedAssociationStyle = BpmnStyleBuilder.buildFlowStyle({
  type: FlowType.ASSOCIATION,
  associationDirection: AssociationDirection.NONE,
});
console.log(undirectedAssociationStyle);
console.log();

console.log('7. Association (Unidirectional):');
const unidirectionalAssociationStyle = BpmnStyleBuilder.buildFlowStyle({
  type: FlowType.ASSOCIATION,
  associationDirection: AssociationDirection.ONE,
});
console.log(unidirectionalAssociationStyle);
console.log();

console.log('8. Data Association:');
const dataAssociationStyle = BpmnStyleBuilder.buildFlowStyle({
  type: FlowType.DATA_ASSOCIATION,
});
console.log(dataAssociationStyle);
console.log();

// Test 6: Data Object Styles
console.log('\n--- Data Object Styles ---\n');

console.log('1. Data Object:');
const dataObjectStyle = BpmnStyleBuilder.buildDataObjectStyle({
  type: DataObjectType.DATA_OBJECT,
});
console.log(dataObjectStyle);
console.log();

console.log('2. Data Object (Collection):');
const dataObjectCollectionStyle = BpmnStyleBuilder.buildDataObjectStyle({
  type: DataObjectType.DATA_OBJECT,
  isCollection: true,
});
console.log(dataObjectCollectionStyle);
console.log();

console.log('3. Data Store:');
const dataStoreStyle = BpmnStyleBuilder.buildDataObjectStyle({
  type: DataObjectType.DATA_STORE,
});
console.log(dataStoreStyle);
console.log();

// Test 7: Artifact Styles
console.log('\n--- Artifact Styles ---\n');

console.log('1. Text Annotation:');
const textAnnotationStyle = BpmnStyleBuilder.buildTextAnnotationStyle();
console.log(textAnnotationStyle);
console.log();

console.log('2. Group:');
const groupStyle = BpmnStyleBuilder.buildGroupStyle();
console.log(groupStyle);
console.log();

console.log('\n===== All Tests Completed =====');
