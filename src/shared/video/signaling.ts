// The channel used to set up a video call, through the normal API (server/src/routes/signal.js).
// The browser polls for new messages: quickly while a call is being set up, then about once a second.
// The video itself goes directly between the browsers.
//
// Events fired: connect, disconnect, resume, connect_error, room:replaced, peer:left, peer:back,
// plus whatever the other side or the server sent (signal, peer:joined, session:live, ...).
import { api, ApiError } from '../api';

type Handler = (data: any) => void;

export interface SignalingChannel {
  on(event: string, handler: Handler): void;
  emit(event: string, data?: unknown, ack?: (reply: any) => void): void;
  close(): void;
}

const FAST_MS = 250;
const SLOW_MS = 1000;
// After any message, poll quickly for this long, so a call connects in a few seconds.
const FAST_WINDOW_MS = 20000;

export function openSignaling(token: string, sessionId: string): SignalingChannel {
  return new PollingChannel(token, sessionId);
}

class PollingChannel implements SignalingChannel {
  private handlers = new Map<string, Handler[]>();
  private client = crypto.randomUUID();
  private after = 0;
  private joined = false;
  private closed = false;
  private timer = 0;
  private failures = 0;
  private peerOnline = false;
  private fastUntil = 0;

  constructor(private token: string, private sessionId: string) {
    window.setTimeout(() => this.fire('connect'), 0);
  }

  private fire(event: string, data?: unknown) {
    this.handlers.get(event)?.forEach((handler) => handler(data));
  }

  private path(action: string) {
    return `/signal/${encodeURIComponent(this.sessionId)}/${action}`;
  }

  private hurry() {
    this.fastUntil = Date.now() + FAST_WINDOW_MS;
  }

  private schedule(delay: number) {
    window.clearTimeout(this.timer);
    if (!this.closed) this.timer = window.setTimeout(() => void this.poll(), delay);
  }

  private async join(ack?: (reply: any) => void) {
    try {
      const reply = await api<{ peerPresent: boolean }>(this.path('join'), { token: this.token, body: { client: this.client } });
      this.joined = true;
      this.after = 0;
      this.peerOnline = reply.peerPresent;
      this.hurry();
      ack?.(reply);
      this.schedule(0);
    } catch (err) {
      if (err instanceof ApiError && err.status > 0) {
        ack?.({ error: err.message });
      } else {
        // Could not reach the server: try joining again shortly.
        this.fire('connect_error');
        window.setTimeout(() => !this.closed && this.fire('connect'), 3000);
      }
    }
  }

  private async poll() {
    if (this.closed || !this.joined) return;
    try {
      const result = await api<{ replaced: boolean; peerOnline: boolean; messages: { id: number; event: string; data: unknown }[] }>(
        `${this.path('poll')}?client=${this.client}&after=${this.after}`, { token: this.token },
      );
      if (this.closed) return;
      if (this.failures >= 2) this.fire('resume');
      this.failures = 0;
      if (result.replaced) {
        this.closed = true;
        this.fire('room:replaced');
        return;
      }
      for (const message of result.messages) {
        if (message.id <= this.after) continue;
        this.after = message.id;
        this.hurry();
        this.fire(message.event, message.data);
      }
      if (this.peerOnline && !result.peerOnline) this.fire('peer:left');
      if (!this.peerOnline && result.peerOnline) this.fire('peer:back');
      this.peerOnline = result.peerOnline;
      this.schedule(Date.now() < this.fastUntil ? FAST_MS : SLOW_MS);
    } catch {
      this.failures += 1;
      if (this.failures === 2) this.fire('disconnect', 'network');
      this.schedule(Math.min(1000 * this.failures, 5000));
    }
  }

  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
  }

  emit(event: string, data?: unknown, ack?: (reply: any) => void) {
    if (event === 'room:join') {
      void this.join(ack);
      return;
    }
    if (!this.joined || this.closed) return;
    this.hurry();
    this.schedule(FAST_MS);
    api(this.path('send'), { token: this.token, body: { client: this.client, event, data } }).catch(() => undefined);
  }

  close() {
    this.closed = true;
    window.clearTimeout(this.timer);
  }
}
