import { describe, expect, test } from "bun:test";

import { UptimeRobotApiClient } from "../client.js";

describe("UptimeRobotApiClient", () => {
  test("lists monitors with bearer auth and query params", async () => {
    let capturedUrl = "";
    let capturedHeaders: Headers | undefined;

    const client = new UptimeRobotApiClient("test-token", (async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedHeaders = new Headers(init?.headers);

      return new Response(
        JSON.stringify({
          data: [{ id: 42, friendlyName: "Production API", url: "https://api.example.com/health", status: "DOWN" }],
          nextLink: null,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch);

    const result = await client.listMonitors({
      limit: 25,
      status: "DOWN,UP",
      name: "Production",
    });

    expect(capturedUrl).toBe("https://api.uptimerobot.com/v3/monitors?limit=25&status=DOWN%2CUP&name=Production");
    expect(capturedHeaders?.get("authorization")).toBe("Bearer test-token");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.friendlyName).toBe("Production API");
  });

  test("pauses a monitor with an empty JSON body", async () => {
    let capturedMethod = "";
    let capturedBody = "";

    const client = new UptimeRobotApiClient("test-token", (async (input: string | URL | Request, init?: RequestInit) => {
      capturedMethod = init?.method ?? "GET";
      capturedBody = String(init?.body ?? "");

      expect(String(input)).toBe("https://api.uptimerobot.com/v3/monitors/801150533/pause");

      return new Response(JSON.stringify({ id: 801150533, friendlyName: "My API", status: "PAUSED" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch);

    const result = await client.pauseMonitor(801150533);

    expect(capturedMethod).toBe("POST");
    expect(capturedBody).toBe("{}");
    expect(result.status).toBe("PAUSED");
  });

  test("creates a monitor with a JSON request body", async () => {
    let capturedMethod = "";
    let capturedBody = "";

    const client = new UptimeRobotApiClient("test-token", (async (_input: string | URL | Request, init?: RequestInit) => {
      capturedMethod = init?.method ?? "GET";
      capturedBody = String(init?.body ?? "");

      return new Response(JSON.stringify({ id: 99, friendlyName: "API", status: "STARTED" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch);

    const result = await client.createMonitor({
      friendlyName: "API",
      url: "https://api.example.com/health",
      type: "HTTP",
      interval: 300,
    });

    expect(capturedMethod).toBe("POST");
    expect(JSON.parse(capturedBody)).toEqual({
      friendlyName: "API",
      url: "https://api.example.com/health",
      type: "HTTP",
      interval: 300,
    });
    expect(result.id).toBe(99);
  });
});
