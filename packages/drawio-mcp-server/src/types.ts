export const bus_request_stream = "BUS_REQUEST";
export const bus_reply_stream = "BUS_REPLY";

export type TargetDocumentSelector = {
  id: string;
};

export type CurrentDocumentPageInfo = {
  index: number;
  id: string;
  name: string;
  is_current: true;
};

export type ConnectedDocumentInfo = {
  id: string;
  title: string | null;
  mode: string | null;
  hash: string | null;
  file_url: string | null;
  page_count: number;
  current_page: CurrentDocumentPageInfo | null;
};

export type ResolvedDocumentTarget = {
  connection_id: string;
  target_document: TargetDocumentSelector;
  document: ConnectedDocumentInfo;
};

export type BusListener<RL> = (reply: RL) => void;
export type BusUnsubscribe = () => void;
export type Bus = {
  send_to_extension: <RQ>(request: RQ) => void;
  on_reply_from_extension: <RL>(
    event_name: string,
    listener: BusListener<RL>,
  ) => BusUnsubscribe;
};
export type IdGenerator = {
  generate: () => string;
};

export type RequestQueue = {
  enqueue: <T>(key: string, task: () => Promise<T>) => Promise<T>;
};

export type Logger = {
  log: (level: string, message?: any, ...data: any[]) => void;
  debug: (message?: any, ...data: any[]) => void;
};

export type DocumentRouting = {
  list_documents: () => Promise<ConnectedDocumentInfo[]>;
  resolve_target_document: (
    args: Record<string, unknown>,
  ) => Promise<ResolvedDocumentTarget>;
};

export type Context = {
  bus: Bus;
  id_generator: IdGenerator;
  request_queue: RequestQueue;
  document_routing: DocumentRouting;
  log: Logger;
};
