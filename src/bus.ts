export const bus_request_stream = "BUS_REQUEST";
export const bus_reply_stream = "BUS_REPLY";

export type BusListener<RL> = (reply: RL) => void;
export type Bus = {
  send_to_extension: <RQ>(request: RQ) => void;
  on_reply_from_extension: <RL>(
    event_name: string,
    listener: BusListener<RL>,
  ) => void;
};
export type Context = {
  bus: Bus;
};
