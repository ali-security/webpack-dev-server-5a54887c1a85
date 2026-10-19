"use strict";

const webpack = require("webpack");
const Server = require("../../lib/Server");
const config = require("../fixtures/client-config/webpack.config");
const runBrowser = require("../helpers/run-browser");
const [port1, port2] = require("../ports-map")["cross-origin-request"];

describe("cross-origin requests", () => {
  const devServerPort = port1;
  const htmlServerPort = port2;
  const htmlServerHost = "127.0.0.1";

  it("should return 403 for cross-origin no-cors non-module script tag requests", async () => {
    const compiler = webpack(config);
    const devServerOptions = {
      port: devServerPort,
      allowedHosts: "auto",
    };
    const server = new Server(devServerOptions, compiler);

    await server.start();

    // Start a separate server for serving the HTML file
    const http = require("http");
    const htmlServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <head>
            <script src="http://localhost:${devServerPort}/main.js"></script>
          </head>
          <body></body>
        </html>
      `);
    });
    htmlServer.listen(htmlServerPort, htmlServerHost);

    const { page, browser } = await runBrowser();

    try {
      const pageErrors = [];

      page.on("pageerror", (error) => {
        pageErrors.push(error);
      });

      const scriptTagRequest = page.waitForResponse(
        `http://localhost:${devServerPort}/main.js`
      );

      await page.goto(`http://${htmlServerHost}:${htmlServerPort}`);

      const response = await scriptTagRequest;

      expect(response.status()).toBe(403);
    } finally {
      await browser.close();
      await server.stop();
      htmlServer.close();
    }
  });

  it("should return 200 for cross-origin cors non-module script tag requests", async () => {
    const compiler = webpack(config);
    const devServerOptions = {
      port: devServerPort,
      allowedHosts: "auto",
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    };
    const server = new Server(devServerOptions, compiler);

    await server.start();

    // Start a separate server for serving the HTML file
    const http = require("http");
    const htmlServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <head>
            <script src="http://localhost:${devServerPort}/main.js" crossorigin></script>
          </head>
          <body></body>
        </html>
      `);
    });
    htmlServer.listen(htmlServerPort, htmlServerHost);

    const { page, browser } = await runBrowser();

    try {
      const pageErrors = [];

      page.on("pageerror", (error) => {
        pageErrors.push(error);
      });

      const scriptTagRequest = page.waitForResponse(
        `http://localhost:${devServerPort}/main.js`
      );

      await page.goto(`http://${htmlServerHost}:${htmlServerPort}`);

      const response = await scriptTagRequest;

      expect(response.status()).toBe(200);
    } finally {
      await browser.close();
      await server.stop();
      htmlServer.close();
    }
  });

  it("should return 200 for cross-origin no-cors non-module script tag requests with the 'allowedHost' option and 'all' value", async () => {
    const compiler = webpack(config);
    const devServerOptions = {
      port: devServerPort,
      allowedHosts: "all",
    };
    const server = new Server(devServerOptions, compiler);

    await server.start();

    // Start a separate server for serving the HTML file
    const http = require("http");
    const htmlServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <head>
            <script src="http://localhost:${devServerPort}/main.js"></script>
          </head>
          <body></body>
        </html>
      `);
    });
    htmlServer.listen(htmlServerPort, htmlServerHost);

    const { page, browser } = await runBrowser();

    try {
      const pageErrors = [];

      page.on("pageerror", (error) => {
        pageErrors.push(error);
      });

      const scriptTagRequest = page.waitForResponse(
        `http://localhost:${devServerPort}/main.js`
      );

      await page.goto(`http://${htmlServerHost}:${htmlServerPort}`);

      const response = await scriptTagRequest;

      expect(response.status()).toBe(200);
    } finally {
      await browser.close();
      await server.stop();
      htmlServer.close();
    }
  });

  it("should return 200 for cross-origin no-cors non-module script tag requests with the `allowedHost` option and the `localhost` value", async () => {
    const compiler = webpack(config);
    const devServerOptions = {
      port: devServerPort,
      allowedHosts: ["localhost"],
    };
    const server = new Server(devServerOptions, compiler);

    await server.start();

    // Start a separate server for serving the HTML file
    const http = require("http");
    const htmlServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <head>
            <script src="http://localhost:${devServerPort}/main.js"></script>
          </head>
          <body></body>
        </html>
      `);
    });
    htmlServer.listen(htmlServerPort, htmlServerHost);

    const { page, browser } = await runBrowser();

    try {
      const pageErrors = [];

      page.on("pageerror", (error) => {
        pageErrors.push(error);
      });

      const scriptTagRequest = page.waitForResponse(
        `http://localhost:${devServerPort}/main.js`
      );

      await page.goto(`http://${htmlServerHost}:${htmlServerPort}`);

      const response = await scriptTagRequest;

      expect(response.status()).toBe(200);
    } finally {
      await browser.close();
      await server.stop();
      htmlServer.close();
    }
  });
});

// @see https://github.com/webpack/webpack-dev-server/security/advisories/GHSA-79cf-xcqc-c78w
describe("cross-origin resource policy header", () => {
  const devServerPort = port1;

  let server;

  afterEach(async () => {
    if (server) {
      await server.stop();
      // Allow the port to be fully released before the next test
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      server = null;
    }
  });

  function request(url, headers = {}) {
    const http = require("http");

    return new Promise((resolve, reject) => {
      const req = http.get(url, { headers }, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode, headers: res.headers, body });
        });
      });
      req.on("error", reject);
    });
  }

  it("should set Cross-Origin-Resource-Policy: same-origin by default", async () => {
    const compiler = webpack(config);
    server = new Server(
      { port: devServerPort, allowedHosts: "auto" },
      compiler
    );

    await server.start();

    const res = await request(`http://localhost:${devServerPort}/main.js`);

    expect(res.headers["cross-origin-resource-policy"]).toBe("same-origin");
  });

  it("should NOT set CORP header when allowedHosts is 'all'", async () => {
    const compiler = webpack(config);
    server = new Server({ port: devServerPort, allowedHosts: "all" }, compiler);

    await server.start();

    const res = await request(`http://localhost:${devServerPort}/main.js`);

    expect(res.headers["cross-origin-resource-policy"]).toBeUndefined();
  });

  it("should NOT set CORP header when user configures wildcard CORS", async () => {
    const compiler = webpack(config);
    server = new Server(
      {
        port: devServerPort,
        allowedHosts: "auto",
        headers: { "Access-Control-Allow-Origin": "*" },
      },
      compiler
    );

    await server.start();

    const res = await request(`http://localhost:${devServerPort}/main.js`);

    expect(res.headers["cross-origin-resource-policy"]).toBeUndefined();
  });

  it("should set CORP header when user configures a specific-origin Access-Control-Allow-Origin (no-cors embedding is not governed by CORS)", async () => {
    const compiler = webpack(config);
    server = new Server(
      {
        port: devServerPort,
        allowedHosts: "auto",
        headers: {
          "Access-Control-Allow-Origin": "http://foo.example.com",
        },
      },
      compiler
    );

    await server.start();

    const res = await request(`http://localhost:${devServerPort}/main.js`);

    expect(res.headers["cross-origin-resource-policy"]).toBe("same-origin");
  });

  it("should set CORP header when user configures Access-Control-Allow-Origin via headers array with a specific origin", async () => {
    const compiler = webpack(config);
    server = new Server(
      {
        port: devServerPort,
        allowedHosts: "auto",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "http://foo.example.com",
          },
        ],
      },
      compiler
    );

    await server.start();

    const res = await request(`http://localhost:${devServerPort}/main.js`);

    expect(res.headers["cross-origin-resource-policy"]).toBe("same-origin");
  });

  it("should NOT set CORP header when user configures wildcard Access-Control-Allow-Origin via headers array", async () => {
    const compiler = webpack(config);
    server = new Server(
      {
        port: devServerPort,
        allowedHosts: "auto",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
      compiler
    );

    await server.start();

    const res = await request(`http://localhost:${devServerPort}/main.js`);

    expect(res.headers["cross-origin-resource-policy"]).toBeUndefined();
  });

  it("should NOT set CORP header when host is in allowedHosts", async () => {
    const compiler = webpack(config);
    server = new Server(
      { port: devServerPort, allowedHosts: ["localhost"] },
      compiler
    );

    await server.start();

    const res = await request(`http://localhost:${devServerPort}/main.js`);

    expect(res.status).toBe(200);
    expect(res.headers["cross-origin-resource-policy"]).toBeUndefined();
  });
});

describe("cross-site request forgery on state-changing endpoints", () => {
  const devServerPort = port1;
  const endpoint = "/webpack-dev-server/invalidate";

  let server;

  beforeEach(async () => {
    const compiler = webpack(config);
    server = new Server(
      { port: devServerPort, allowedHosts: "auto" },
      compiler
    );

    await server.start();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
      // Allow the port to be fully released before the next test
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      server = null;
    }
  });

  function request(path, headers = {}) {
    const http = require("http");

    return new Promise((resolve, reject) => {
      const req = http.get(
        `http://localhost:${devServerPort}${path}`,
        { headers },
        (res) => {
          let body = "";
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            resolve({ status: res.statusCode, body });
          });
        }
      );
      req.on("error", reject);
    });
  }

  it(`should block cross-site requests to ${endpoint}`, async () => {
    const res = await request(endpoint, {
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "cross-site",
    });

    expect(res.status).toBe(403);
    expect(res.body).toBe("Cross-Origin request blocked");
  });

  it(`should block same-site (cross-origin) requests to ${endpoint}`, async () => {
    const res = await request(endpoint, {
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
    });

    expect(res.status).toBe(403);
    expect(res.body).toBe("Cross-Origin request blocked");
  });

  it(`should allow same-origin requests to ${endpoint}`, async () => {
    const res = await request(endpoint, {
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    });

    expect(res.status).toBe(200);
  });

  it(`should allow user-initiated navigations to ${endpoint}`, async () => {
    const res = await request(endpoint, { "sec-fetch-site": "none" });

    expect(res.status).toBe(200);
  });

  it("should block requests with a cross-origin Origin and no Sec-Fetch metadata", async () => {
    const res = await request("/webpack-dev-server/invalidate", {
      origin: "http://evil.example",
    });

    expect(res.status).toBe(403);
  });

  it("should allow requests without Sec-Fetch metadata or Origin (e.g. curl)", async () => {
    const res = await request("/webpack-dev-server/invalidate");

    expect(res.status).toBe(200);
  });
});

describe("malformed Host/Origin headers", () => {
  const devServerPort = port1;

  let server;

  afterEach(async () => {
    if (server) {
      await server.stop();
      // Allow the port to be fully released before the next test
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      server = null;
    }
  });

  function getMainBundleStatus() {
    const http = require("http");

    return new Promise((resolve, reject) => {
      http
        .get(`http://localhost:${devServerPort}/main.js`, (res) => {
          res.resume();
          resolve(res.statusCode);
        })
        .on("error", reject);
    });
  }

  // An invalid IPv6 literal, and a soft hyphen that IDNA maps to an empty
  // hostname (`url.parse()` throws on them on newer Node.js versions).
  it.each(["http://[::1/", "http://­/"])(
    "should reject a WebSocket upgrade with the malformed %p Origin header without crashing",
    async (origin) => {
      const WebSocket = require("ws");

      const compiler = webpack(config);
      server = new Server(
        { port: devServerPort, allowedHosts: "auto" },
        compiler
      );

      await server.start();

      // A malformed `Origin` used to throw while being parsed and take down
      // the whole dev-server process.
      await new Promise((resolve) => {
        const ws = new WebSocket(`ws://localhost:${devServerPort}/ws`, {
          headers: {
            host: `localhost:${devServerPort}`,
            origin,
          },
        });
        // Don't wait forever for a server that never answers
        const timeout = setTimeout(() => {
          ws.terminate();
        }, 5000);

        ws.on("close", () => {
          clearTimeout(timeout);
          resolve();
        });
        ws.on("error", () => {});
      });

      // The server must still be alive: a normal request still succeeds.
      expect(await getMainBundleStatus()).toBe(200);
    }
  );

  it.each(["[::1", "­"])(
    "should reject a request with the malformed %p Host header without crashing",
    async (host) => {
      const net = require("net");

      const compiler = webpack(config);
      server = new Server(
        { port: devServerPort, allowedHosts: "auto" },
        compiler
      );

      await server.start();

      // A malformed `Host` sent on a plain request used to throw while being
      // parsed. Sent over a raw socket (`latin1` keeps every character a single
      // byte) so the malformed value reaches the server as-is.
      const response = await new Promise((resolve) => {
        let data = "";

        const socket = net.connect(devServerPort, "localhost", () => {
          socket.write(
            `GET /main.js HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`,
            "latin1"
          );
        });

        socket.setEncoding("latin1");
        socket.on("data", (chunk) => {
          data += chunk;
        });
        socket.on("error", () => {});
        socket.on("close", () => {
          resolve(data);
        });
      });

      expect(response).toContain("Invalid Host header");

      // The server must still be alive: a normal request still succeeds.
      expect(await getMainBundleStatus()).toBe(200);
    }
  );
});
