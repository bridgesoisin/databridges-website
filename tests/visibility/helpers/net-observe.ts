import net from "node:net";

// Independent view of what the process actually did on the network, taken below the fetch layer.
// A "lookup" event is emitted by a socket once its (custom) lookup produced an address, so it shows
// the exact address a connection was about to be made to.

export interface ConnectionObserver {
  // Number of Socket.connect() calls (every attempt, including ones that never got an address).
  connectCalls: number;
  // Addresses sockets resolved to, in order.
  lookups: string[];
  // Remote addresses of sockets that completed a TCP connection.
  connected: string[];
  stop(): void;
}

type EmitFn = (this: net.Socket, event: string | symbol, ...args: unknown[]) => boolean;

export function observeConnections(): ConnectionObserver {
  const proto = net.Socket.prototype as unknown as { emit: EmitFn; connect: (...args: unknown[]) => net.Socket };
  const originalEmit = proto.emit;
  const originalConnect = proto.connect;

  const observer: ConnectionObserver = {
    connectCalls: 0,
    lookups: [],
    connected: [],
    stop() {
      proto.emit = originalEmit;
      proto.connect = originalConnect;
    },
  };

  proto.emit = function patchedEmit(this: net.Socket, event: string | symbol, ...args: unknown[]): boolean {
    if (event === "lookup" && typeof args[1] === "string") observer.lookups.push(args[1]);
    if (event === "connect" && this.remoteAddress) observer.connected.push(this.remoteAddress);
    return originalEmit.call(this, event, ...args);
  };
  proto.connect = function patchedConnect(this: net.Socket, ...args: unknown[]): net.Socket {
    observer.connectCalls += 1;
    return originalConnect.apply(this, args);
  };
  return observer;
}

export interface Tripwire {
  // Connection attempts that were refused by the tripwire.
  readonly attempts: number;
  stop(): void;
}

// Makes any attempt to open a client socket fail loudly. Used when the only acceptable outcome is a refusal
// before the network, so a regression cannot reach a real address.
export function armTripwire(): Tripwire {
  const proto = net.Socket.prototype as unknown as { connect: (...args: unknown[]) => net.Socket };
  const originalConnect = proto.connect;
  let attempts = 0;
  proto.connect = function trippedConnect(): net.Socket {
    attempts += 1;
    throw new Error("TRIPWIRE: a client connection was attempted");
  };
  return {
    get attempts() {
      return attempts;
    },
    stop() {
      proto.connect = originalConnect;
    },
  };
}

export interface HangingConnect {
  // Connection attempts that were swallowed.
  readonly attempts: number;
  stop(): void;
}

// Simulates a destination that never answers the TCP handshake (a dropped SYN) without sending a packet:
// the socket stays in the connecting state forever.
export function armHangingConnect(): HangingConnect {
  const proto = net.Socket.prototype as unknown as { connect: (...args: unknown[]) => net.Socket };
  const originalConnect = proto.connect;
  let attempts = 0;
  proto.connect = function hangingConnect(this: net.Socket): net.Socket {
    attempts += 1;
    (this as unknown as { connecting: boolean }).connecting = true;
    return this;
  };
  return {
    get attempts() {
      return attempts;
    },
    stop() {
      proto.connect = originalConnect;
    },
  };
}
