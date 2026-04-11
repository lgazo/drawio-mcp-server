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
export type IdGenerator = {
  generate: () => string;
};

export type RequestQueue = {
  enqueue: <T>(task: () => Promise<T>) => Promise<T>;
};

export type Logger = {
  log: (level: string, message?: any, ...data: any[]) => void;
  debug: (message?: any, ...data: any[]) => void;
};

export type Context = {
  bus: Bus;
  id_generator: IdGenerator;
  request_queue: RequestQueue;
  log: Logger;
};
