---
title: Build a WebSocket server · Cloudflare Durable Objects docs
description: Build a WebSocket server using Durable Objects and Workers.
lastUpdated: 2025-08-18T14:27:42.000Z
chatbotDeprioritize: false
tags: WebSockets
source_url:
  html: https://developers.cloudflare.com/durable-objects/examples/websocket-server/
  md: https://developers.cloudflare.com/durable-objects/examples/websocket-server/index.md
---

This example shows how to build a WebSocket server using Durable Objects and Workers. The example exposes an endpoint to create a new WebSocket connection. This WebSocket connection echos any message while including the total number of WebSocket connections currently established. For more information, refer to [Use Durable Objects with WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

Warning

WebSocket connections pin your Durable Object to memory, and so duration charges will be incurred so long as the WebSocket is connected (regardless of activity). To avoid duration charges during periods of inactivity, use the [WebSocket Hibernation API](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/), which only charges for duration when JavaScript is actively executing.

* JavaScript

  ```js
  import { DurableObject } from "cloudflare:workers";


  // Worker
  export default {
    async fetch(request, env, ctx) {
      if (request.url.endsWith("/websocket")) {
        // Expect to receive a WebSocket Upgrade request.
        // If there is one, accept the request and return a WebSocket Response.
        const upgradeHeader = request.headers.get("Upgrade");
        if (!upgradeHeader || upgradeHeader !== "websocket") {
          return new Response("Worker expected Upgrade: websocket", {
            status: 426,
          });
        }


        if (request.method !== "GET") {
          return new Response("Worker expected GET method", {
            status: 400,
          });
        }


        // Since we are hard coding the Durable Object ID by providing the constant name 'foo',
        // all requests to this Worker will be sent to the same Durable Object instance.
        let id = env.WEBSOCKET_SERVER.idFromName("foo");
        let stub = env.WEBSOCKET_SERVER.get(id);


        return stub.fetch(request);
      }


      return new Response(
        `Supported endpoints:
  /websocket: Expects a WebSocket upgrade request`,
        {
          status: 200,
          headers: {
            "Content-Type": "text/plain",
          },
        },
      );
    },
  };


  // Durable Object
  export class WebSocketServer extends DurableObject {
    // Keeps track of all WebSocket connections
    sessions;


    constructor(ctx, env) {
      super(ctx, env);
      this.sessions = new Map();
    }


    async fetch(request) {
      // Creates two ends of a WebSocket connection.
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);


      // Calling `accept()` tells the runtime that this WebSocket is to begin terminating
      // request within the Durable Object. It has the effect of "accepting" the connection,
      // and allowing the WebSocket to send and receive messages.
      server.accept();


      // Generate a random UUID for the session.
      const id = crypto.randomUUID();
      // Add the WebSocket connection to the map of active sessions.
      this.sessions.set(server, { id });


      server.addEventListener("message", (event) => {
        this.handleWebSocketMessage(server, event.data);
      });


      // If the client closes the connection, the runtime will close the connection too.
      server.addEventListener("close", () => {
        this.handleConnectionClose(server);
      });


      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }


    async handleWebSocketMessage(ws, message) {
      const connection = this.sessions.get(ws);


      // Reply back with the same message to the connection
      ws.send(`[Durable Object] message: ${message}, from: ${connection.id}`);


      // Broadcast the message to all the connections,
      // except the one that sent the message.
      this.sessions.forEach((k, session) => {
        if (session !== ws) {
          session.send(
            `[Durable Object] message: ${message}, from: ${connection.id}`,
          );
        }
      });


      // Broadcast the message to all the connections,
      // including the one that sent the message.
      this.sessions.forEach((k, session) => {
        session.send(
          `[Durable Object] message: ${message}, from: ${connection.id}`,
        );
      });
    }


    async handleConnectionClose(ws) {
      this.sessions.delete(ws);
      ws.close(1000, "Durable Object is closing WebSocket");
    }
  }
  ```

* TypeScript

  ```ts
  import { DurableObject } from 'cloudflare:workers';


  // Worker
  export default {
      async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
          if (request.url.endsWith('/websocket')) {
              // Expect to receive a WebSocket Upgrade request.
              // If there is one, accept the request and return a WebSocket Response.
              const upgradeHeader = request.headers.get('Upgrade');
              if (!upgradeHeader || upgradeHeader !== 'websocket') {
                  return new Response('Worker expected Upgrade: websocket', {
                      status: 426,
                  });
              }


              if (request.method !== 'GET') {
                  return new Response('Worker expected GET method', {
                      status: 400,
                  });
              }


              // Since we are hard coding the Durable Object ID by providing the constant name 'foo',
              // all requests to this Worker will be sent to the same Durable Object instance.
              let id = env.WEBSOCKET_SERVER.idFromName('foo');
              let stub = env.WEBSOCKET_SERVER.get(id);


              return stub.fetch(request);
          }


          return new Response(
              `Supported endpoints:
  /websocket: Expects a WebSocket upgrade request`,
              {
                  status: 200,
                  headers: {
                      'Content-Type': 'text/plain',
                  },
              }
          );
      },
  };


  // Durable Object
  export class WebSocketServer extends DurableObject {
      // Keeps track of all WebSocket connections
      sessions: Map<WebSocket, { [key: string]: string }>;


      constructor(ctx: DurableObjectState, env: Env) {
          super(ctx, env);
          this.sessions = new Map();
      }


      async fetch(request: Request): Promise<Response> {
          // Creates two ends of a WebSocket connection.
          const webSocketPair = new WebSocketPair();
          const [client, server] = Object.values(webSocketPair);


          // Calling `accept()` tells the runtime that this WebSocket is to begin terminating
          // request within the Durable Object. It has the effect of "accepting" the connection,
          // and allowing the WebSocket to send and receive messages.
          server.accept();


          // Generate a random UUID for the session.
          const id = crypto.randomUUID();
          // Add the WebSocket connection to the map of active sessions.
          this.sessions.set(server, { id });


          server.addEventListener('message', (event) => {
              this.handleWebSocketMessage(server, event.data);
          });


          // If the client closes the connection, the runtime will close the connection too.
          server.addEventListener('close', () => {
              this.handleConnectionClose(server);
          });


          return new Response(null, {
              status: 101,
              webSocket: client,
          });
      }


      async handleWebSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
          const connection = this.sessions.get(ws)!;


          // Reply back with the same message to the connection
          ws.send(`[Durable Object] message: ${message}, from: ${connection.id}`);


          // Broadcast the message to all the connections,
          // except the one that sent the message.
          this.sessions.forEach((k, session) => {
              if (session !== ws) {
                  session.send(`[Durable Object] message: ${message}, from: ${connection.id}`);
              }
          });


          // Broadcast the message to all the connections,
          // including the one that sent the message.
          this.sessions.forEach((k, session) => {
              session.send(`[Durable Object] message: ${message}, from: ${connection.id}`);
          });
      }


      async handleConnectionClose(ws: WebSocket) {
          this.sessions.delete(ws);
          ws.close(1000, 'Durable Object is closing WebSocket');
      }
  }
  ```

Finally, configure your Wrangler file to include a Durable Object [binding](https://developers.cloudflare.com/durable-objects/get-started/#4-configure-durable-object-bindings) and [migration](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/) based on the namespace and class name chosen previously.

* wrangler.jsonc

  ```jsonc
  {
    "name": "websocket-server",
    "main": "src/index.ts",
    "durable_objects": {
      "bindings": [
        {
          "name": "WEBSOCKET_SERVER",
          "class_name": "WebSocketServer"
        }
      ]
    },
    "migrations": [
      {
        "tag": "v1",
        "new_sqlite_classes": [
          "WebSocketServer"
        ]
      }
    ]
  }
  ```

* wrangler.toml

  ```toml
  name = "websocket-server"
  main = "src/index.ts"


  [[durable_objects.bindings]]
  name = "WEBSOCKET_SERVER"
  class_name = "WebSocketServer"


  [[migrations]]
  tag = "v1"
  new_sqlite_classes = ["WebSocketServer"]
  ```

### Related resources

* [Durable Objects: Edge Chat Demo](https://github.com/cloudflare/workers-chat-demo).
