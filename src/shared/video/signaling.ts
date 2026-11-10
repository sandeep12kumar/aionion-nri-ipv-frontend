// The channel used to set up a video call. Locally this is Socket.IO on our own server.
// Live (VITE_WS_URL set) it is an API Gateway WebSocket, with messages handled by server/lambda/ws.js.
import { io } from 'socket.io-client';

type Handler = (data: any) => void;

export interface SignalingChannel {
  on(event: string, handler: Handler): void;
  emit(event: string, data?: unknown, ack?: (reply: any) => void): void;
  close(): void;
}

const WS_URL = import.meta.env.VITE_WS_URL;

export function openSignaling(token: string, sessionId: string): SignalingChannel {
  if (!WS_URL) {
    const socket = io({ auth: { token } });
    return {
      on: (event, handler) => socket.on(event, handler),
      emit: (event, data, ack) => (ack ? socket.emit(event, data, ack) : socket.emit(event, data)),
      close: () => socket.disconnect(),
    };
  }
  return new GatewayChannel(WS_URL, token, sessionId);
}

// Same events as the Socket.IO version: connect, disconnect, connect_error, plus server messages.
// It reconnects by itself, and pings so API Gateway doesn't close a quiet call after 10 minutes.
class GatewayChannel implements SignalingChannel {
  private socket: WebSocket | null = null;
  private handlers = new Map<string, Handler[]>();
  private acks = new Map<string, (reply: any) => void>();
  private nextAck = 0;
  private closed = false;
  private retryDelay = 1000;
  private pinger = 0;

  constructor(private url: string, private token: string, private sessionId: string) {
    this.connect();
  }

  private fire(event: string, data?: unknown) {
    this.handlers.get(event)?.forEach((handler) => handler(data));
  }

  private connect() {
    const socket = new WebSocket(`${this.url}?token=${encodeURIComponent(this.token)}`);
    this.socket = socket;
    let opened = false;
    socket.onopen = () => {
      opened = true;
      this.retryDelay = 1000;
      this.fire('connect');
      this.pinger = window.setInterval(() => this.send({ event: 'ping' }), 5 * 60 * 1000);
    };
    socket.onmessage = ({ data }) => {
      const { event, data: payload } = JSON.parse(data);
      if (event === 'ack') {
        this.acks.get(payload.id)?.(payload.data);
        this.acks.delete(payload.id);
      } else {
        this.fire(event, payload);
      }
    };
    socket.onclose = () => {
      window.clearInterval(this.pinger);
      if (this.closed) return;
      this.fire(opened ? 'disconnect' : 'connect_error', 'transport close');
      window.setTimeout(() => !this.closed && this.connect(), this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 2, 15000);
    };
  }

  private send(message: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ ...message, token: this.token, sessionId: this.sessionId }));
    }
  }

  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
  }

  emit(event: string, data?: unknown, ack?: (reply: any) => void) {
    let id: string | undefined;
    if (ack) {
      id = String(++this.nextAck);
      this.acks.set(id, ack);
    }
    this.send({ event, data, ack: id });
  }

  close() {
    this.closed = true;
    window.clearInterval(this.pinger);
    this.socket?.close();
  }
}
