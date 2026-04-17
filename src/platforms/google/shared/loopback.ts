import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

import { AutoCliError } from "../../../errors.js";

type LoopbackCodeListenerInput = {
  clientId: string;
  scopes: readonly string[];
  redirectUri?: string;
  state?: string;
  loginHint?: string;
  timeoutSeconds?: number;
  buildAuthUrl: (input: {
    clientId: string;
    redirectUri: string;
    scopes: readonly string[];
    state: string;
    loginHint?: string;
  }) => string;
};

export type GoogleLoopbackAuthorization = {
  redirectUri: string;
  authUrl: string;
  state: string;
  waitForCode(): Promise<string>;
  close(): Promise<void>;
};

const DEFAULT_TIMEOUT_SECONDS = 300;
const SUCCESS_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>AutoCLI Google Login</title>
    <style>
      body { font-family: sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
      h1 { margin-bottom: 0.5rem; }
      code { background: #f4f4f5; padding: 0.15rem 0.35rem; border-radius: 0.25rem; }
    </style>
  </head>
  <body>
    <h1>Google login captured</h1>
    <p>AutoCLI received the authorization code successfully.</p>
    <p>You can close this tab and return to <code>autocli</code>.</p>
  </body>
</html>`;

const ERROR_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>AutoCLI Google Login Error</title>
    <style>
      body { font-family: sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
      h1 { margin-bottom: 0.5rem; color: #991b1b; }
      code { background: #fef2f2; padding: 0.15rem 0.35rem; border-radius: 0.25rem; }
    </style>
  </head>
  <body>
    <h1>Google login failed</h1>
    <p>AutoCLI did not receive a valid authorization code.</p>
    <p>Return to the terminal and try again.</p>
  </body>
</html>`;

export async function startGoogleLoopbackAuthorization(
  input: LoopbackCodeListenerInput,
): Promise<GoogleLoopbackAuthorization> {
  const target = resolveLoopbackTarget(input.redirectUri);
  const listenPort = target.port ? Number.parseInt(target.port, 10) : 0;
  const timeoutMs = Math.max(1, Math.floor(input.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS)) * 1000;
  const state = input.state?.trim() || randomBytes(16).toString("hex");

  let settled = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let resolvedCode: string | null = null;
  let rejectedError: unknown;
  const waiters: Array<{
    resolve: (code: string) => void;
    reject: (error: unknown) => void;
  }> = [];

  const server = createServer((request, response) => {
    void handleLoopbackRequest({
      requestUrl: request.url,
      expectedPathname: target.pathname,
      expectedState: state,
      redirectUri,
      response,
      onSuccess: (code) => {
        if (settled) {
          return;
        }

        settled = true;
        resolvedCode = code;
        clearLoopbackTimeout(timeout);
        timeout = null;
        void closeServer(server);
        for (const waiter of waiters.splice(0)) {
          waiter.resolve(code);
        }
      },
      onError: (error) => {
        if (settled) {
          return;
        }

        settled = true;
        rejectedError = error;
        clearLoopbackTimeout(timeout);
        timeout = null;
        void closeServer(server);
        for (const waiter of waiters.splice(0)) {
          waiter.reject(error);
        }
      },
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ port: listenPort, host: target.hostname }, () => {
      server.off("error", reject);
      resolve();
    });
  }).catch((error) => {
    throw new AutoCliError(
      "GOOGLE_LOOPBACK_LISTEN_FAILED",
      `Could not listen for the Google OAuth callback on ${target.hostname}:${listenPort || 0}.`,
      { cause: error },
    );
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new AutoCliError("GOOGLE_LOOPBACK_LISTEN_FAILED", "AutoCLI could not determine the Google OAuth callback address.");
  }

  const redirectUri = new URL(`${target.pathname}${target.search}`, `http://${target.hostname}:${address.port}`).toString();
  const authUrl = input.buildAuthUrl({
    clientId: input.clientId,
    redirectUri,
    scopes: input.scopes,
    state,
    loginHint: input.loginHint,
  });

  timeout = setTimeout(() => {
    if (settled) {
      return;
    }

    settled = true;
    rejectedError = new AutoCliError(
      "GOOGLE_OAUTH_CALLBACK_TIMEOUT",
      `Timed out waiting for the Google OAuth callback on ${redirectUri}.`,
      {
        details: {
          redirectUri,
          timeoutSeconds: timeoutMs / 1000,
        },
      },
    );
    void closeServer(server);
    for (const waiter of waiters.splice(0)) {
      waiter.reject(rejectedError);
    }
  }, timeoutMs);

  return {
    redirectUri,
    authUrl,
    state,
    waitForCode: async () => {
      if (resolvedCode) {
        return resolvedCode;
      }
      if (rejectedError) {
        throw rejectedError;
      }

      return await new Promise<string>((resolve, reject) => {
        waiters.push({ resolve, reject });
      });
    },
    close: async () => {
      if (settled) {
        return;
      }

      settled = true;
      clearLoopbackTimeout(timeout);
      timeout = null;
      await closeServer(server);
    },
  };
}

function resolveLoopbackTarget(redirectUri: string | undefined): URL {
  const normalized = redirectUri?.trim() || "http://127.0.0.1/callback";
  let url: URL;
  try {
    url = new URL(normalized);
  } catch (error) {
    throw new AutoCliError("GOOGLE_REDIRECT_URI_INVALID", `Invalid Google OAuth redirect URI "${normalized}".`, { cause: error });
  }

  if (url.protocol !== "http:") {
    throw new AutoCliError("GOOGLE_REDIRECT_URI_INVALID", "Google loopback login requires an http:// redirect URI.");
  }

  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new AutoCliError(
      "GOOGLE_REDIRECT_URI_INVALID",
      "Google loopback login only supports localhost or 127.0.0.1 redirect URIs.",
      {
        details: {
          redirectUri: normalized,
        },
      },
    );
  }

  if (url.username || url.password) {
    throw new AutoCliError("GOOGLE_REDIRECT_URI_INVALID", "Google loopback redirect URIs cannot include credentials.");
  }

  return url;
}

async function handleLoopbackRequest(input: {
  requestUrl: string | undefined;
  expectedPathname: string;
  expectedState: string;
  redirectUri: string;
  response: {
    writeHead(statusCode: number, headers: Record<string, string>): void;
    end(body?: string): void;
  };
  onSuccess: (code: string) => void;
  onError: (error: AutoCliError) => void;
}): Promise<void> {
  const url = new URL(input.requestUrl || "/", input.redirectUri);
  if (url.pathname !== input.expectedPathname) {
    input.response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    input.response.end(ERROR_HTML);
    return;
  }

  const errorValue = url.searchParams.get("error");
  if (errorValue) {
    input.response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
    input.response.end(ERROR_HTML);
    input.onError(new AutoCliError("GOOGLE_OAUTH_DENIED", `Google OAuth returned "${errorValue}".`));
    return;
  }

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state && !code) {
    input.response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
    input.response.end(ERROR_HTML);
    return;
  }

  if (state !== input.expectedState) {
    input.response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
    input.response.end(ERROR_HTML);
    input.onError(new AutoCliError("GOOGLE_OAUTH_STATE_MISMATCH", "Google OAuth returned a mismatched state parameter."));
    return;
  }

  if (!code) {
    input.response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
    input.response.end(ERROR_HTML);
    input.onError(new AutoCliError("GOOGLE_AUTH_CODE_REQUIRED", "Google OAuth did not return an authorization code."));
    return;
  }

  input.response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  input.response.end(SUCCESS_HTML);
  input.onSuccess(code);
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

function clearLoopbackTimeout(timeout: ReturnType<typeof setTimeout> | null): void {
  if (timeout) {
    clearTimeout(timeout);
  }
}
