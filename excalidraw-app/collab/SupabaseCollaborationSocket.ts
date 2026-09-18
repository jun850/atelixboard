import { WS_EVENTS } from "../app_constants";
import { requireSupabase } from "../supabase/client";

import type { RealtimeChannel, User } from "@supabase/supabase-js";

import type {
  CollaborationEventHandler,
  CollaborationSocket,
} from "./CollaborationSocket";

type BroadcastPayload = {
  senderId: string;
  encryptedData: string;
  iv: string;
};

type FollowPayload = {
  senderId: string;
  userToFollow?: { socketId?: string };
  action?: "FOLLOW" | "UNFOLLOW";
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const hexToBytes = (value: string) => {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const createSocketId = (user: User) =>
  `${user.id}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

export class SupabaseCollaborationSocket implements CollaborationSocket {
  id: string;
  private readonly roomId: string;
  private readonly user: User;
  private readonly handlers = new Map<string, Set<CollaborationEventHandler>>();
  private readonly onceHandlers = new Map<
    string,
    Set<CollaborationEventHandler>
  >();
  private readonly followedBy = new Set<string>();
  private channel: RealtimeChannel | null = null;
  private closed = false;

  constructor(roomId: string, user: User) {
    this.roomId = roomId;
    this.user = user;
    this.id = createSocketId(user);
  }

  on(event: string, handler: CollaborationEventHandler) {
    const handlers = this.handlers.get(event) || new Set();
    handlers.add(handler);
    this.handlers.set(event, handlers);
    return this;
  }

  once(event: string, handler: CollaborationEventHandler) {
    const handlers = this.onceHandlers.get(event) || new Set();
    handlers.add(handler);
    this.onceHandlers.set(event, handlers);
    return this;
  }

  off(event: string, handler?: CollaborationEventHandler) {
    if (!handler) {
      this.handlers.delete(event);
      this.onceHandlers.delete(event);
      return this;
    }
    this.handlers.get(event)?.delete(handler);
    this.onceHandlers.get(event)?.delete(handler);
    return this;
  }

  emit(event: string, ...args: any[]) {
    if (event === "join-room") {
      void this.joinRoom();
      return this;
    }

    if (event === WS_EVENTS.SERVER || event === WS_EVENTS.SERVER_VOLATILE) {
      const [, encryptedData, iv] = args as [string, ArrayBuffer, Uint8Array];
      void this.send("client-broadcast", {
        senderId: this.id,
        encryptedData: bytesToHex(new Uint8Array(encryptedData)),
        iv: bytesToHex(iv),
      });
      return this;
    }

    if (event === WS_EVENTS.USER_FOLLOW_CHANGE) {
      void this.send("user-follow", {
        senderId: this.id,
        ...args[0],
      });
      return this;
    }

    this.emitLocal(event, ...args);
    return this;
  }

  async connect() {
    try {
      const client = requireSupabase();
      if (this.closed) {
        return;
      }

      this.channel = client.channel(`board:${this.roomId}:collaboration`, {
        config: {
          private: true,
          presence: { key: this.id },
        },
      });

      this.channel
        .on("presence", { event: "sync" }, () => this.syncPresence())
        .on("broadcast", { event: "client-broadcast" }, ({ payload }) => {
          const data = payload as BroadcastPayload;
          if (data.senderId === this.id) {
            return;
          }
          const encryptedBytes = hexToBytes(data.encryptedData);
          this.emitLocal(
            "client-broadcast",
            encryptedBytes.buffer,
            hexToBytes(data.iv),
          );
        })
        .on("broadcast", { event: "new-user" }, ({ payload }) => {
          if (payload.senderId !== this.id) {
            this.emitLocal("new-user", payload.senderId);
          }
        })
        .on("broadcast", { event: "user-follow" }, ({ payload }) => {
          this.handleFollow(payload as FollowPayload);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            this.emitLocal("init-room");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            this.emitLocal(
              "connect_error",
              new Error(`Supabase Realtime connection failed: ${status}`),
            );
          }
        });
    } catch (error) {
      this.emitLocal("connect_error", error);
      throw error;
    }
  }

  close() {
    this.closed = true;
    const channel = this.channel;
    this.channel = null;
    if (channel) {
      void channel.untrack().finally(() => {
        void requireSupabase().removeChannel(channel);
      });
    }
    this.handlers.clear();
    this.onceHandlers.clear();
  }

  private async joinRoom() {
    if (!this.channel || this.closed) {
      return;
    }
    const existingClients = this.getPresentClientIds();
    await this.channel.track({
      socket_id: this.id,
      user_id: this.user.id,
      email: this.user.email,
      joined_at: new Date().toISOString(),
    });

    if (existingClients.length === 0) {
      this.emitLocal("first-in-room");
    } else {
      await this.send("new-user", { senderId: this.id });
    }
  }

  private syncPresence() {
    this.emitLocal("room-user-change", this.getPresentClientIds());
  }

  private getPresentClientIds() {
    if (!this.channel) {
      return [];
    }
    return Object.values(this.channel.presenceState())
      .flat()
      .map((presence) => {
        const trackedPresence = presence as typeof presence & {
          socket_id?: string;
        };
        return String(trackedPresence.socket_id || presence.presence_ref);
      })
      .filter(Boolean);
  }

  private handleFollow(payload: FollowPayload) {
    if (
      !payload.senderId ||
      payload.userToFollow?.socketId !== this.id ||
      !payload.action
    ) {
      return;
    }
    if (payload.action === "FOLLOW") {
      this.followedBy.add(payload.senderId);
    } else {
      this.followedBy.delete(payload.senderId);
    }
    this.emitLocal(
      WS_EVENTS.USER_FOLLOW_ROOM_CHANGE,
      Array.from(this.followedBy),
    );
  }

  private async send(event: string, payload: Record<string, unknown>) {
    if (!this.channel || this.closed) {
      return;
    }
    const status = await this.channel.send({
      type: "broadcast",
      event,
      payload,
    });
    if (status !== "ok") {
      this.emitLocal(
        "connect_error",
        new Error(`Supabase Realtime send failed: ${status}`),
      );
    }
  }

  private emitLocal(event: string, ...args: any[]) {
    this.handlers.get(event)?.forEach((handler) => handler(...args));
    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      this.onceHandlers.delete(event);
      onceHandlers.forEach((handler) => handler(...args));
    }
  }
}
