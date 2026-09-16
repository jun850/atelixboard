export type CollaborationEventHandler = (...args: any[]) => void;

export interface CollaborationSocket {
  id?: string;
  on: (
    event: string,
    handler: CollaborationEventHandler,
  ) => CollaborationSocket;
  once: (
    event: string,
    handler: CollaborationEventHandler,
  ) => CollaborationSocket;
  off: (
    event: string,
    handler?: CollaborationEventHandler,
  ) => CollaborationSocket;
  emit: (event: string, ...args: any[]) => CollaborationSocket;
  close: () => void;
}
