"use strict";

const http = require("http");
const url = require("url");
const request = require("supertest");
const webpack = require("webpack");
const WebSocket = require("ws");
const Server = require("../../lib/Server");
const config = require("../fixtures/proxy-config/webpack.config");
const [devServerPort, backendPort] =
  require("../ports-map")["proxy-web-socket-origin"];

const WebSocketServer = WebSocket.Server;

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// @see https://github.com/webpack/webpack-dev-server/security/advisories/GHSA-cfqc-fj3v-j925
describe.each(["target", "router"])(
  "proxied WebSocket upgrade origin validation with %s",
  (proxyOption) => {
    let server;
    let backend;
    let webSocketServer;
    let backendConnections;
    let backendSockets;

    function createProxyConfig(proxyConfig) {
      if (proxyOption === "router") {
        const { target, ...options } = proxyConfig;

        return { ...options, router: () => target };
      }

      return proxyConfig;
    }

    async function startServer(proxy, options = {}) {
      const compiler = webpack(config);

      server = new Server(
        {
          port: devServerPort,
          allowedHosts: "auto",
          client: false,
          hot: false,
          liveReload: false,
          proxy: [
            typeof proxy === "function"
              ? () => createProxyConfig(proxy())
              : createProxyConfig(proxy),
          ],
          ...options,
        },
        compiler
      );

      await server.start();
    }

    beforeEach(async () => {
      backendConnections = 0;
      backendSockets = new Set();

      // A stand-in for a service the developer proxies over WebSocket.
      backend = http.createServer((req, res) => {
        res.end("backend response");
      });
      backend.on("connection", (socket) => {
        backendSockets.add(socket);
        socket.on("close", () => {
          backendSockets.delete(socket);
        });
      });
      webSocketServer = new WebSocketServer({ server: backend });
      webSocketServer.on("connection", (client) => {
        backendConnections += 1;
        client.send("INTERNAL-SERVICE-SECRET");
      });
      await new Promise((resolve) => {
        backend.listen(backendPort, "127.0.0.1", resolve);
      });

      await startServer({
        context: ["/api"],
        target: `http://127.0.0.1:${backendPort}`,
        ws: true,
      });
    });

    afterEach(async () => {
      await server.stop();
      for (const client of webSocketServer.clients) {
        client.terminate();
      }
      webSocketServer.close();
      for (const socket of backendSockets) {
        socket.destroy();
      }
      await new Promise((resolve) => {
        backend.close(resolve);
      });
    });

    function upgrade(origin, headers = {}) {
      return new Promise((resolve) => {
        const req = http.request({
          host: "localhost",
          port: devServerPort,
          path: "/api/socket",
          timeout: 8000,
          headers: {
            Connection: "Upgrade",
            Upgrade: "websocket",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version": "13",
            ...(typeof origin === "string" ? { Origin: origin } : {}),
            ...headers,
          },
        });

        req.on("upgrade", (res, socket) => {
          socket.destroy();
          resolve({ upgraded: true, status: res.statusCode });
        });
        req.on("response", (res) => {
          res.resume();
          resolve({ upgraded: false, status: res.statusCode });
        });
        req.on("timeout", () => {
          req.destroy();
          resolve({ upgraded: false });
        });
        req.on("error", () => {
          resolve({ upgraded: false });
        });
        req.end();
      });
    }

    it("should reject a cross-origin proxied WebSocket upgrade", async () => {
      const result = await upgrade("http://evil.example.com");

      expect(result.upgraded).toBe(false);
      expect(result.status).toBe(403);
      expect(backendConnections).toBe(0);
    });

    it("should reject a proxied WebSocket upgrade from an IP address origin", async () => {
      const result = await upgrade("http://203.0.113.10");

      expect(result.upgraded).toBe(false);
      expect(result.status).toBe(403);
      expect(backendConnections).toBe(0);
    });

    it("should allow a same-origin proxied WebSocket upgrade", async () => {
      const result = await upgrade(`http://localhost:${devServerPort}`);

      expect(result.upgraded).toBe(true);
      expect(result.status).toBe(101);
      expect(backendConnections).toBe(1);
    });

    it("should reject an upgrade with an invalid Host header", async () => {
      const result = await upgrade(`http://localhost:${devServerPort}`, {
        Host: "evil.example.com",
      });

      expect(result.status).toBe(403);
      expect(backendConnections).toBe(0);
    });

    it("should reject an upgrade without an Origin header", async () => {
      const result = await upgrade();

      expect(result.status).toBe(403);
      expect(backendConnections).toBe(0);
    });

    it("should not forward a rejected upgrade after an HTTP proxy request", async () => {
      await request(server.server).get("/api/hello").expect(200);

      const result = await upgrade("http://evil.example.com");

      expect(result.upgraded).toBe(false);
      expect(result.status).toBe(403);

      // A separate upgrade listener can still contact the backend after the
      // client receives the rejection, so allow that forwarding to finish.
      await wait(100);

      expect(backendConnections).toBe(0);
    });

    it("should allow a same-origin upgrade after an HTTP proxy request", async () => {
      await request(server.server).get("/api/hello").expect(200);

      const result = await upgrade(`http://localhost:${devServerPort}`);

      expect(result.upgraded).toBe(true);
      expect(result.status).toBe(101);
      expect(backendConnections).toBe(1);
    });

    it("should validate upgrades using the current proxy callback configuration", async () => {
      await server.stop();

      let proxyConfig = {
        context: ["/api"],
        target: `http://127.0.0.1:${backendPort}`,
        ws: false,
        pathRewrite: { "^/api": "/initial" },
      };

      await startServer(() => {
        return { ...proxyConfig };
      });
      await request(server.server).get("/api/hello").expect(200);

      proxyConfig = {
        ...proxyConfig,
        ws: true,
        pathRewrite: { "^/api": "/updated" },
      };

      await request(server.server).get("/api/hello").expect(200);

      const rejected = await upgrade("http://evil.example.com");

      expect(rejected.status).toBe(403);

      await wait(100);

      expect(backendConnections).toBe(0);

      let backendPath;

      backend.once("upgrade", (req) => {
        backendPath = req.url;
      });

      const allowed = await upgrade(`http://localhost:${devServerPort}`);

      expect(allowed.status).toBe(101);
      expect(backendConnections).toBe(1);
      expect(backendPath).toBe("/updated/socket");
    });

    it("should allow an upgrade from an origin listed in 'allowedHosts'", async () => {
      await server.stop();

      await startServer(
        {
          context: ["/api"],
          target: `http://127.0.0.1:${backendPort}`,
          ws: true,
        },
        { allowedHosts: [".example.test"] }
      );

      const rejected = await upgrade("http://evil.example.com");

      expect(rejected.status).toBe(403);
      expect(backendConnections).toBe(0);

      const allowed = await upgrade("http://app.example.test");

      expect(allowed.upgraded).toBe(true);
      expect(allowed.status).toBe(101);
      expect(backendConnections).toBe(1);
    });

    // A malformed `Host` or `Origin` header value can make `url.parse()` throw,
    // which used to take down the whole dev server process.
    describe.each([
      ["as parsed by the current Node.js version", false],
      ["when 'url.parse()' throws on them", true],
    ])("with malformed headers %s", (_mode, simulateThrowingParse) => {
      // An invalid IPv6 literal, and a soft hyphen that IDNA maps to an empty
      // hostname, both rejected by `url.parse()` on newer Node.js versions.
      const malformedHosts = ["[::1", "­"];
      const malformedOrigins = ["http://[::1/", "http://­/"];
      const malformedValues = [...malformedHosts, ...malformedOrigins];

      beforeEach(() => {
        if (!simulateThrowingParse) {
          return;
        }

        // Older Node.js versions parse these values into an odd hostname
        // instead of throwing, simulate newer ones to cover the guards there.
        const originalParse = url.parse;

        jest.spyOn(url, "parse").mockImplementation((input, ...args) => {
          if (malformedValues.includes(String(input).replace(/^\/\//, ""))) {
            throw new TypeError(`Invalid URL: ${input}`);
          }

          return originalParse(input, ...args);
        });
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it.each(malformedOrigins)(
        "should reject a proxied WebSocket upgrade with the malformed %p Origin header",
        async (origin) => {
          const result = await upgrade(origin);

          expect(result.upgraded).toBe(false);
          expect(result.status).toBe(403);
          expect(backendConnections).toBe(0);

          // The dev server must still be alive.
          await request(server.server).get("/api/hello").expect(200);
        }
      );

      it.each(malformedHosts)(
        "should reject a proxied WebSocket upgrade with the malformed %p Host header",
        async (host) => {
          const result = await upgrade(`http://localhost:${devServerPort}`, {
            Host: host,
          });

          expect(result.upgraded).toBe(false);
          expect(result.status).toBe(403);
          expect(backendConnections).toBe(0);

          // The dev server must still be alive.
          await request(server.server).get("/api/hello").expect(200);
        }
      );
    });
  }
);
