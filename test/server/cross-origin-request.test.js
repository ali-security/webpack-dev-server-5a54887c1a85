"use strict";

const request = require("supertest");
const webpack = require("webpack");
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
});
