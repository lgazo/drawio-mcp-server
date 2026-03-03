export function reply_name(event_name: string, request_id: string) {
  return `${event_name}.${request_id}`;
}
