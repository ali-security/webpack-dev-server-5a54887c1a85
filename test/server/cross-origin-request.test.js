"use strict";

const net = require("net");
const url = require("url");
const request = require("supertest");
const webpack = require("webpack");
const WebSocket = require("ws");
const Server = require("../../lib/Server");
const config = require("../fixtures/client-config/webpack.config");
const port = require("../ports-map")["cross-origin-request-option"];

const corpHeader = "cross-origin-resource-policy";

describe("cross-origin request check", () => {
  describe("with the default 'allowedHosts' option", () => {
    let server;
    let req;

    beforeAll(async () => {
      const compiler = webpack(config);

      server = new Server({ port }, compiler);

      await server.start();

      req = request(server.app);
    });

    afterAll(async () => {
      await server.stop();
    });

    it("should return 403 for cross-site no-cors requests of the bundle", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`)
        .set("Sec-Fetch-Mode", "no-cors")
        .set("Sec-Fetch-Site", "cross-site")
        .set("Sec-Fetch-Dest", "script");

      expect(response.status).toEqual(403);
      expect(response.text).toEqual("Cross-Origin request blocked");
    });

    it("should return 403 for cross-site no-cors requests using an IP address as host", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `127.0.0.1:${port}`)
        .set("Sec-Fetch-Mode", "no-cors")
        .set("Sec-Fetch-Site", "cross-site");

      expect(response.status).toEqual(403);
      expect(response.text).toEqual("Cross-Origin request blocked");
    });

    it("should return 403 for cross-site no-cors requests of built-in routes", async () => {
      const response = await req
        .get("/webpack-dev-server")
        .set("Host", `localhost:${port}`)
        .set("Sec-Fetch-Mode", "no-cors")
        .set("Sec-Fetch-Site", "cross-site");

      expect(response.status).toEqual(403);
      expect(response.text).toEqual("Cross-Origin request blocked");
    });

    it("should return 200 for cross-site cors requests", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`)
        .set("Sec-Fetch-Mode", "cors")
        .set("Sec-Fetch-Site", "cross-site");

      expect(response.status).toEqual(200);
    });

    it("should return 200 for same-origin no-cors requests", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`)
        .set("Sec-Fetch-Mode", "no-cors")
        .set("Sec-Fetch-Site", "same-origin");

      expect(response.status).toEqual(200);
    });

    it("should return 200 for same-site no-cors requests", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`)
        .set("Sec-Fetch-Mode", "no-cors")
        .set("Sec-Fetch-Site", "same-site");

      expect(response.status).toEqual(200);
    });

    it("should return 200 for user-initiated no-cors requests", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`)
        .set("Sec-Fetch-Mode", "no-cors")
        .set("Sec-Fetch-Site", "none");

      expect(response.status).toEqual(200);
    });

    it("should return 200 for cross-site navigation requests", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`)
        .set("Sec-Fetch-Mode", "navigate")
        .set("Sec-Fetch-Site", "cross-site");

      expect(response.status).toEqual(200);
    });

    it("should return 200 for requests without fetch metadata headers", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`);

      expect(response.status).toEqual(200);
    });

    it("should set the 'Cross-Origin-Resource-Policy: same-origin' header for requests without fetch metadata headers", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`);

      expect(response.status).toEqual(200);
      expect(response.headers[corpHeader]).toEqual("same-origin");
    });

    it("should set the 'Cross-Origin-Resource-Policy: same-origin' header for built-in routes", async () => {
      const response = await req
        .get("/webpack-dev-server")
        .set("Host", `localhost:${port}`);

      expect(response.status).toEqual(200);
      expect(response.headers[corpHeader]).toEqual("same-origin");
    });
  });

  describe("with the 'allowedHosts' option and the 'all' value", () => {
    let server;
    let req;

    beforeAll(async () => {
      const compiler = webpack(config);

      server = new Server({ port, allowedHosts: "all" }, compiler);

      await server.start();

      req = request(server.app);
    });

    afterAll(async () => {
      await server.stop();
    });

    it("should return 200 for cross-site no-cors requests", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`)
        .set("Sec-Fetch-Mode", "no-cors")
        .set("Sec-Fetch-Site", "cross-site");

      expect(response.status).toEqual(200);
    });

    it("should not set the 'Cross-Origin-Resource-Policy' header", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`);

      expect(response.status).toEqual(200);
      expect(response.headers[corpHeader]).toBeUndefined();
    });
  });

  describe("with the 'allowedHosts' option and explicit hosts", () => {
    let server;
    let req;

    beforeAll(async () => {
      const compiler = webpack(config);

      server = new Server(
        { port, allowedHosts: ["localhost", ".example.com"] },
        compiler
      );

      await server.start();

      req = request(server.app);
    });

    afterAll(async () => {
      await server.stop();
    });

    it("should return 200 for cross-site no-cors requests to an allowed host", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`)
        .set("Sec-Fetch-Mode", "no-cors")
        .set("Sec-Fetch-Site", "cross-site");

      expect(response.status).toEqual(200);
    });

    it("should return 200 for cross-site no-cors requests to an allowed subdomain", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `app.example.com:${port}`)
        .set("Sec-Fetch-Mode", "no-cors")
        .set("Sec-Fetch-Site", "cross-site");

      expect(response.status).toEqual(200);
    });

    it("should return 403 for cross-site no-cors requests to a host that is not explicitly allowed", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `127.0.0.1:${port}`)
        .set("Sec-Fetch-Mode", "no-cors")
        .set("Sec-Fetch-Site", "cross-site");

      expect(response.status).toEqual(403);
      expect(response.text).toEqual("Cross-Origin request blocked");
    });

    it("should not set the 'Cross-Origin-Resource-Policy' header for an allowed host", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`);

      expect(response.status).toEqual(200);
      expect(response.headers[corpHeader]).toBeUndefined();
    });

    it("should set the 'Cross-Origin-Resource-Policy: same-origin' header for a host that is not explicitly allowed", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `127.0.0.1:${port}`);

      expect(response.status).toEqual(200);
      expect(response.headers[corpHeader]).toEqual("same-origin");
    });
  });

  describe("with a wildcard 'Access-Control-Allow-Origin' header in the 'headers' option", () => {
    let server;
    let req;

    beforeAll(async () => {
      const compiler = webpack(config);

      server = new Server(
        {
          port,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
        compiler
      );

      await server.start();

      req = request(server.app);
    });

    afterAll(async () => {
      await server.stop();
    });

    it("should not set the 'Cross-Origin-Resource-Policy' header", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`);

      expect(response.status).toEqual(200);
      expect(response.headers["access-control-allow-origin"]).toEqual("*");
      expect(response.headers[corpHeader]).toBeUndefined();
    });
  });

  describe("with a wildcard 'Access-Control-Allow-Origin' header in the 'headers' option as an array", () => {
    let server;
    let req;

    beforeAll(async () => {
      const compiler = webpack(config);

      server = new Server(
        {
          port,
          headers: [{ key: "access-control-allow-origin", value: " * " }],
        },
        compiler
      );

      await server.start();

      req = request(server.app);
    });

    afterAll(async () => {
      await server.stop();
    });

    it("should not set the 'Cross-Origin-Resource-Policy' header", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`);

      expect(response.status).toEqual(200);
      expect(response.headers[corpHeader]).toBeUndefined();
    });
  });

  describe("with a specific-origin 'Access-Control-Allow-Origin' header in the 'headers' option", () => {
    let server;
    let req;

    beforeAll(async () => {
      const compiler = webpack(config);

      server = new Server(
        {
          port,
          headers: {
            "Access-Control-Allow-Origin": "http://foo.example.com",
          },
        },
        compiler
      );

      await server.start();

      req = request(server.app);
    });

    afterAll(async () => {
      await server.stop();
    });

    it("should set the 'Cross-Origin-Resource-Policy: same-origin' header", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`);

      expect(response.status).toEqual(200);
      expect(response.headers[corpHeader]).toEqual("same-origin");
    });
  });

  describe("with a 'headers' option function returning a wildcard 'Access-Control-Allow-Origin' header", () => {
    let server;
    let req;

    beforeAll(async () => {
      const compiler = webpack(config);

      server = new Server(
        {
          port,
          headers: () => {
            return { "Access-Control-Allow-Origin": "*" };
          },
        },
        compiler
      );

      await server.start();

      req = request(server.app);
    });

    afterAll(async () => {
      await server.stop();
    });

    it("should still set the 'Cross-Origin-Resource-Policy: same-origin' header", async () => {
      const response = await req
        .get("/main.js")
        .set("Host", `localhost:${port}`);

      expect(response.status).toEqual(200);
      expect(response.headers[corpHeader]).toEqual("same-origin");
    });
  });

  describe("cross-site request forgery on the '/webpack-dev-server/invalidate' endpoint", () => {
    const endpoint = "/webpack-dev-server/invalidate";

    let server;
    let req;

    beforeAll(async () => {
      const compiler = webpack(config);

      server = new Server({ port, allowedHosts: "auto" }, compiler);

      await server.start();

      req = request(server.app);
    });

    afterAll(async () => {
      await server.stop();
    });

    it("should return 403 for cross-site requests", async () => {
      const response = await req
        .get(endpoint)
        .set("Host", `localhost:${port}`)
        .set("Sec-Fetch-Mode", "cors")
        .set("Sec-Fetch-Site", "cross-site");

      expect(response.status).toEqual(403);
      expect(response.text).toEqual("Cross-Origin request blocked");
    });

    it("should return 403 for cross-site navigations", async () => {
      const response = await req
        .get(endpoint)
        .set("Host", `localhost:${port}`)
        .set("Sec-Fetch-Mode", "navigate")
        .set("Sec-Fetch-Site", "cross-site");

      expect(response.status).toEqual(403);
      expect(response.text).toEqual("Cross-Origin request blocked");
    });

    it("should return 403 for same-site (cross-origin) requests", async () => {
      const response = await req
        .get(endpoint)
        .set("Host", `localhost:${port}`)
        .set("Origin", "http://localhost:9999")
        .set("Sec-Fetch-Mode", "cors")
        .set("Sec-Fetch-Site", "same-site");

      expect(response.status).toEqual(403);
      expect(response.text).toEqual("Cross-Origin request blocked");
    });

    it("should return 403 for a cross-origin 'Origin' header without 'Sec-Fetch-*' metadata", async () => {
      const response = await req
        .get(endpoint)
        .set("Host", `localhost:${port}`)
        .set("Origin", "http://evil.example");

      expect(response.status).toEqual(403);
      expect(response.text).toEqual("Cross-Origin request blocked");
    });

    it("should allow same-origin requests", async () => {
      const response = await req
        .get(endpoint)
        .set("Host", `localhost:${port}`)
        .set("Sec-Fetch-Mode", "cors")
        .set("Sec-Fetch-Site", "same-origin");

      expect(response.status).toEqual(200);
    });

    it("should allow user-initiated navigations", async () => {
      const response = await req
        .get(endpoint)
        .set("Host", `localhost:${port}`)
        .set("Sec-Fetch-Mode", "navigate")
        .set("Sec-Fetch-Site", "none");

      expect(response.status).toEqual(200);
    });

    it("should allow a same-origin 'Origin' header without 'Sec-Fetch-*' metadata", async () => {
      const response = await req
        .get(endpoint)
        .set("Host", `localhost:${port}`)
        .set("Origin", `http://localhost:${port}`);

      expect(response.status).toEqual(200);
    });

    it("should allow requests without 'Sec-Fetch-*' metadata or 'Origin' (e.g. curl)", async () => {
      const response = await req
        .get(endpoint)
        .set("Host", `localhost:${port}`)
        .set("User-Agent", "curl/7.79.1");

      expect(response.status).toEqual(200);
    });
  });

  // A malformed `Host` or `Origin` header value can make `url.parse()` throw,
  // which used to take down the whole dev server process.
  describe("malformed 'Host' and 'Origin' headers", () => {
    // An invalid IPv6 literal, and a soft hyphen that IDNA maps to an empty
    // hostname, both rejected by `url.parse()` on newer Node.js versions.
    const malformedHosts = ["[::1", "­"];
    const malformedOrigins = ["http://[::1/", "http://­/"];
    const malformedValues = [...malformedHosts, ...malformedOrigins];

    let server;

    beforeAll(async () => {
      const compiler = webpack(config);

      server = new Server({ port, allowedHosts: "auto" }, compiler);

      await server.start();
    });

    afterAll(async () => {
      await server.stop();
    });

    function sendRawRequest(host) {
      return new Promise((resolve) => {
        let response = "";

        const socket = net.connect(port, "localhost", () => {
          // `latin1` sends every character of the malformed value as-is
          socket.write(
            `GET /main.js HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`,
            "latin1"
          );
        });

        socket.setEncoding("latin1");
        socket.setTimeout(5000, () => {
          socket.destroy();
        });
        socket.on("data", (chunk) => {
          response += chunk;
        });
        socket.on("error", () => {});
        socket.on("close", () => {
          resolve(response);
        });
      });
    }

    function connectWebSocket(headers) {
      return new Promise((resolve) => {
        const messages = [];
        const ws = new WebSocket(`ws://localhost:${port}/ws`, { headers });
        // don't wait forever for a server that never answers
        const timeout = setTimeout(() => {
          ws.terminate();
        }, 5000);

        ws.on("message", (data) => {
          messages.push(JSON.parse(String(data)));
        });
        ws.on("error", () => {});
        ws.on("close", () => {
          clearTimeout(timeout);
          resolve(messages);
        });
      });
    }

    async function expectServerToBeAlive() {
      const response = await request(server.server)
        .get("/main.js")
        .set("Host", `localhost:${port}`);

      expect(response.status).toEqual(200);
    }

    describe.each([
      ["as parsed by the current Node.js version", false],
      ["when 'url.parse()' throws on them", true],
    ])("%s", (_mode, simulateThrowingParse) => {
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

      it.each(malformedHosts)(
        "should reject the malformed %p 'Host' header without throwing",
        (host) => {
          const results = [
            server.checkHeader({ host }, "host", true),
            server.checkHeader({ host }, "host", false, false),
            server.isSameOrigin({ host, origin: `http://localhost:${port}` }),
          ];

          expect(results).toEqual([false, false, false]);
        }
      );

      it.each(malformedOrigins)(
        "should reject the malformed %p 'Origin' header without throwing",
        (origin) => {
          const host = `localhost:${port}`;
          const results = [
            server.checkHeader({ origin }, "origin", false),
            server.checkHeader({ origin }, "origin", true),
            server.isSameOrigin({ host, origin }),
            server.isSameOriginRequest({ headers: { host, origin } }),
          ];

          expect(results).toEqual([false, false, false, false]);
        }
      );

      it.each(malformedHosts)(
        "should answer a request with the malformed %p 'Host' header and keep serving",
        async (host) => {
          const response = await sendRawRequest(host);

          expect(response).toMatch(/^HTTP\/1\.1 200 /);
          expect(response).toContain("Invalid Host header");

          await expectServerToBeAlive();
        }
      );

      it.each(malformedOrigins)(
        "should block the '/webpack-dev-server/invalidate' endpoint for the malformed %p 'Origin' header",
        async (origin) => {
          const response = await request(server.server)
            .get("/webpack-dev-server/invalidate")
            .set("Host", `localhost:${port}`)
            .set("Origin", origin);

          expect(response.status).toEqual(403);
          expect(response.text).toEqual("Cross-Origin request blocked");

          await expectServerToBeAlive();
        }
      );

      it.each(malformedOrigins)(
        "should reject a WebSocket connection with the malformed %p 'Origin' header and keep serving",
        async (origin) => {
          const messages = await connectWebSocket({
            host: `localhost:${port}`,
            origin,
          });

          expect(messages).toEqual([
            { type: "error", data: "Invalid Host/Origin header" },
          ]);

          await expectServerToBeAlive();
        }
      );

      it.each(malformedHosts)(
        "should reject a WebSocket connection with the malformed %p 'Host' header and keep serving",
        async (host) => {
          const messages = await connectWebSocket({
            host,
            origin: `http://localhost:${port}`,
          });

          expect(messages).toEqual([
            { type: "error", data: "Invalid Host/Origin header" },
          ]);

          await expectServerToBeAlive();
        }
      );
    });
  });
});
