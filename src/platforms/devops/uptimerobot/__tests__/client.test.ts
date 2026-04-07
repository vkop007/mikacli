import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

  test("deletes a monitor when the API returns no content", async () => {
    let capturedMethod = "";

    const client = new UptimeRobotApiClient("test-token", (async (input: string | URL | Request, init?: RequestInit) => {
      capturedMethod = init?.method ?? "GET";

      expect(String(input)).toBe("https://api.uptimerobot.com/v3/monitors/99");

      return new Response(null, {
        status: 204,
      });
    }) as typeof fetch);

    const result = await client.deleteMonitor(99);

    expect(capturedMethod).toBe("DELETE");
    expect(result).toEqual({});
  });

  test("creates a public status page with multipart form data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "uptimerobot-client-"));
    const logoPath = join(dir, "logo.txt");
    await Bun.write(logoPath, "logo");

    let capturedHeaders: Headers | undefined;
    let capturedBody: FormData | undefined;

    try {
      const client = new UptimeRobotApiClient("test-token", (async (_input: string | URL | Request, init?: RequestInit) => {
        capturedHeaders = new Headers(init?.headers);
        capturedBody = init?.body instanceof FormData ? init.body : undefined;

        return new Response(JSON.stringify({ id: 15, friendlyName: "Status Page", status: "ACTIVE" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch);

      const result = await client.createPsp({
        friendlyName: "Status Page",
        logo: {
          filePath: logoPath,
          filename: "logo.txt",
          contentType: "text/plain",
        },
      });

      expect(capturedHeaders?.get("content-type")).toBeNull();
      expect(capturedBody).toBeInstanceOf(FormData);
      expect(capturedBody?.get("friendlyName")).toBe("Status Page");
      expect(capturedBody?.get("logo")).toBeTruthy();
      expect(result.id).toBe(15);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("surfaces validation messages returned as an array", async () => {
    const client = new UptimeRobotApiClient("test-token", ((async () =>
      new Response(
        JSON.stringify({
          message: [
            "timeout must not be greater than 60",
            "timeout must not be less than 0",
          ],
          error: "Bad Request",
          statusCode: 400,
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      )) as unknown) as typeof fetch);

    await expect(
      client.createMonitor({
        friendlyName: "API",
        url: "https://api.example.com/health",
        type: "HTTP",
        interval: 300,
      }),
    ).rejects.toMatchObject({
      message: "timeout must not be greater than 60; timeout must not be less than 0",
    });
  });
});
