// Based on https://github.com/mercurius-js/mercurius/blob/master/lib/subscription-client.js

import type { GraphQLError } from 'graphql';
import WebSocket from 'isomorphic-ws';
import {
  createDeferredPromise,
  type DeferredPromise,
  type GQLResponse,
} from '../utils';
import {
  GQL_COMPLETE,
  GQL_CONNECTION_ACK,
  GQL_CONNECTION_ERROR,
  GQL_CONNECTION_INIT,
  GQL_CONNECTION_KEEP_ALIVE,
  GQL_DATA,
  GQL_ERROR,
  GQL_START,
  GQL_STOP,
  GRAPHQL_WS,
} from './protocol';

export type OperationHandlerPayload = GQLResponse | 'start' | 'complete';

export interface OperationCallbackArg {
  operationId: string;
  payload: OperationHandlerPayload;
}

export type OperationCallback = (arg: OperationCallbackArg) => void;

export interface Operation {
  started: boolean;
  options: {
    query: string;
    variables?: Record<string, unknown>;
  };
  callbacks: Set<OperationCallback>;
  handler: (data: OperationHandlerPayload) => void;
  extensions?: { type: string; payload: unknown }[];
}

export interface ClientOptions {
  /**
   * Should the websocket connection try to reconnect
   *
   * @default true
   */
  reconnect?: boolean;
  /**
   * Amount of reconnection attempts
   *
   * @default Infinity
   */
  maxReconnectAttempts?: number;
  connectionCallback?: () => void;
  failedConnectionCallback?: (payload: unknown) => Promise<void>;
  failedReconnectCallback?: () => void;
  connectionInitPayload?:
    | (() => Promise<Record<string, unknown>> | Record<string, unknown>)
    | Record<string, unknown>;

  headers?: Record<string, string>;
  /**
   * Controls when should the connection be established.
   *
   * `false`: Establish a connection immediately.
   *
   * `true`: Establish a connection on first subscribe and close on last unsubscribe.
   *
   * @default true
   */
  lazy?: boolean;
}

export class Client {
  subscriptionQueryMap: Record<string, string>;

  socket: WebSocket | null;
  headers;
  uri;
  operationId;
  ready;
  operations: Map<string, Operation>;
  operationsCount: Record<string | number, number>;
  tryReconnect;
  maxReconnectAttempts;
  reconnectAttempts;
  connectionCallback;
  failedConnectionCallback;
  failedReconnectCallback;
  connectionInitPayload;
  closedByUser?: boolean;
  reconnecting?: boolean;
  reconnectTimeoutId?: ReturnType<typeof setTimeout>;
  lazy;

  connectedPromise: DeferredPromise<Error | void>;
  socketReady: DeferredPromise<boolean> | undefined;

  constructor(
    uri: string,
    {
      headers = {},
      reconnect = true,
      maxReconnectAttempts = Infinity,
      connectionCallback,
      failedConnectionCallback,
      failedReconnectCallback,
      connectionInitPayload = {},
      lazy = true,
    }: ClientOptions
  ) {
    this.uri = uri;
    this.socket = null;
    this.operationId = 0;
    this.ready = false;
    this.operations = new Map();
    this.operationsCount = {};
    this.lazy = lazy;

    this.subscriptionQueryMap = {};

    this.headers = headers;
    this.tryReconnect = reconnect;
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.reconnectAttempts = 0;
    this.connectionCallback = connectionCallback;
    this.failedConnectionCallback = failedConnectionCallback;
    this.failedReconnectCallback = failedReconnectCallback;
    this.connectionInitPayload = connectionInitPayload;

    if (!lazy) this.connect();

    this.connectedPromise = createDeferredPromise();
  }

  connect() {
    if (this.socket !== null) return;

    this.socket = new WebSocket(this.uri, [GRAPHQL_WS], {
      headers: this.headers,
    });
    var readyPromise = (this.socketReady = createDeferredPromise());

    this.socket.onopen = async () => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          var payload =
            typeof this.connectionInitPayload === 'function'
              ? await this.connectionInitPayload()
              : this.connectionInitPayload;
          this.sendMessage(null, GQL_CONNECTION_INIT, payload);
          readyPromise.resolve(true);
        } catch (err) {
          this.close(this.tryReconnect, false);
          readyPromise.resolve(false);
        }
      } else {
        readyPromise.resolve(false);
      }
    };

    this.socket.onclose = () => {
      if (!this.closedByUser) {
        this.close(this.tryReconnect, false);
      }
      readyPromise.resolve(false);
    };

    this.socket.onerror = () => {};

    this.socket.onmessage = async ({ data }) => {
      await this.handleMessage(data.toString('utf-8'));
    };
  }

  close(tryReconnect = false, closedByUser = true) {
    this.closedByUser = closedByUser;
    this.ready = false;
    this.connectedPromise.resolve(Error('Socket closed!'));

    if (this.socket !== null) {
      if (closedByUser) {
        this.unsubscribeAll();
      }

      this.socket.close();
      this.socket = null;
      this.reconnecting = false;

      if (tryReconnect) {
        this.connectedPromise = createDeferredPromise();

        for (var operationId of this.operations.keys()) {
          var operation = this.operations.get(operationId);

          if (operation) {
            this.operations.set(operationId, {
              ...operation,
              started: false,
            });
          }
        }

        this.reconnect();
      }
    }
  }

  getReconnectDelay() {
    var delayMs = 100 * Math.pow(2, this.reconnectAttempts);

    return Math.min(delayMs, 10000);
  }

  reconnect() {
    if (
      this.reconnecting ||
      this.reconnectAttempts > this.maxReconnectAttempts
    ) {
      return this.failedReconnectCallback && this.failedReconnectCallback();
    }

    this.reconnectAttempts++;
    this.reconnecting = true;

    var delay = this.getReconnectDelay();

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect();
    }, delay);
  }

  async unsubscribe(operationId: string, forceUnsubscribe = false) {
    let count = this.operationsCount[operationId];
    count--;

    if (count === 0 || forceUnsubscribe) {
      this.operationsCount[operationId] = 0;

      this.operations.delete(operationId);

      await this.sendMessage(operationId, GQL_STOP, null);

      if (this.lazy) {
        var self = this;

        setTimeout(() => {
          if (self.operations.size === 0 && this.socket) {
            self.close();
          }
        }, 2000);
      }
    } else {
      this.operationsCount[operationId] = count;
    }
  }

  unsubscribeAll() {
    for (var operationId of this.operations.keys()) {
      this.unsubscribe(operationId, true).catch(console.error);
    }
  }

  sendMessage(
    operationId: number | string | null,
    type: string,
    payload: unknown = {},
    extensions?: unknown
  ) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        if (this.socketReady) {
          var isOk = await this.socketReady.promise;

          if (!isOk) return resolve();
        }

        if (!this.socket) return resolve();

        this.socket.send(
          JSON.stringify({
            id: operationId,
            type,
            payload,
            extensions,
          }),
          (err) => {
            if (err) console.error(err);

            resolve();
          }
        );
        setTimeout(resolve, 200);
      } catch (err) {
        reject(err);
      }
    });
  }

  async handleMessage(message: string) {
    let data;
    let operationId;
    let operation;

    try {
      data = JSON.parse(message);
      operationId = data.id;
    } catch (e) {
      throw new Error(
        `Invalid message received: "${message}" Message must be JSON parsable.`
      );
    }

    if (operationId) {
      operation = this.operations.get(operationId);
    }

    switch (data.type) {
      case GQL_CONNECTION_ACK:
        this.reconnecting = false;
        this.ready = true;
        this.reconnectAttempts = 0;
        this.connectedPromise.resolve();

        for (var operationId of this.operations.keys()) {
          this.startOperation(operationId).catch(console.error);
        }

        if (this.connectionCallback) {
          this.connectionCallback();
        }

        break;
      case GQL_DATA:
        if (operation) operation.handler(data.payload);
        break;
      case GQL_ERROR:
        if (operation) {
          operation.handler({
            data: null,
            errors: [{ message: data.payload } as GraphQLError],
          });
          this.operations.delete(operationId);
        }
        break;
      case GQL_COMPLETE:
        if (operation) {
          operation.handler('complete');
          this.operations.delete(operationId);
        }
        break;
      case GQL_CONNECTION_ERROR:
        this.close(this.tryReconnect, false);
        if (this.failedConnectionCallback) {
          await this.failedConnectionCallback(data.payload);
        }
        break;
      case GQL_CONNECTION_KEEP_ALIVE:
        break;
      default:
        throw new Error(`Invalid message type: "${data.type}"`);
    }
  }

  async startOperation(operationId: string) {
    try {
      await this.connectedPromise.promise;

      var operation = this.operations.get(operationId);
      if (!operation) throw Error('Operation not found, ' + operationId);

      var { started, options, extensions } = operation;

      if (!started) {
        if (!this.ready) return;

        this.operations.set(operationId, {
          ...operation,
          started: true,
        });
        await this.sendMessage(operationId, GQL_START, options, extensions);
      }
    } finally {
    }
  }

  createSubscription(
    query: string,
    variables: Record<string, unknown> | undefined,
    publish: OperationCallback,
    subscriptionString?: string
  ): Promise<string> | string {
    if (!this.socket) this.connect();

    subscriptionString ||= JSON.stringify({
      query,
      variables,
    });

    let operationId = this.subscriptionQueryMap[subscriptionString];

    let startPromise: Promise<void> | undefined;

    try {
      let existingOperation: Operation | undefined;
      if (
        operationId &&
        (existingOperation = this.operations.get(operationId))
      ) {
        existingOperation.callbacks.add(publish);
        this.operationsCount[operationId] =
          this.operationsCount[operationId] + 1;
        return operationId;
      }

      operationId = String(++this.operationId);

      var callbacks = new Set([publish]);

      function handler(payload: OperationHandlerPayload) {
        var event: OperationCallbackArg = {
          operationId,
          payload,
        };
        for (var cb of callbacks) {
          try {
            cb(event);
          } catch (err) {
            console.error(err);
          }
        }
      }

      var operation: Operation = {
        started: false,
        options: { query, variables },
        handler,
        callbacks,
      };

      this.operations.set(operationId, operation);

      startPromise = this.startOperation(operationId);
      this.operationsCount[operationId] = 1;

      this.subscriptionQueryMap[subscriptionString] = operationId;

      return startPromise.then(() => operationId);
    } finally {
      function start() {
        setTimeout(() => {
          publish({
            operationId,
            payload: 'start',
          });
        }, 0);
      }

      if (startPromise) startPromise.then(start);
      else start();
    }
  }
}
