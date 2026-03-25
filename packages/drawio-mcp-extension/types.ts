/**
  EXTENSION-SPECIFIC TYPES
*/

import type {
  DrawioCellOptions,
  DrawioUI,
  DrawIOFunction,
  OptionKey,
} from "drawio-mcp-plugin";

export type { DrawioCellOptions, DrawioUI, DrawIOFunction, OptionKey };

export const bus_request_stream = "BUS_REQUEST";
export const bus_reply_stream = "BUS_REPLY";

export type BusListener<RQ> = (request: RQ) => void;

export type SendReplyToServer = <RL>(reply: RL) => void;
export type OnRequestFromServer = <RQ>(
  event_name: string,
  listener: BusListener<RQ>,
) => void;
export type OnStandardToolRequestFromServer = (
  event_name: string,
  ui: DrawioUI,
  accepted_option_keys: Set<OptionKey>,
  drawio_function: DrawIOFunction,
) => void;
