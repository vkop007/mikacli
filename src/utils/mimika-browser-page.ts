import { randomBytes } from "node:crypto";

import { MikaCliError } from "../errors.js";
import {
  MimikaBrowserGatewayClient,
  normalizeMimikaBrowserOrigin,
  type MimikaBrowserTabHandle,
} from "./mimika-browser-client.js";

import type {
  BrowserContext as PlaywrightBrowserContext,
  Locator as PlaywrightLocator,
  Page as PlaywrightPage,
  Request as PlaywrightRequest,
  Response as PlaywrightResponse,
} from "playwright-core";

type Matcher =
  | { kind: "string"; value: string; exact: boolean }
  | { kind: "regex"; source: string; flags: string };

type LocatorStep =
  | { kind: "css"; selector: string }
  | { kind: "text"; matcher: Matcher }
  | { kind: "label"; matcher: Matcher }
  | { kind: "role"; role: string; name?: Matcher }
  | { kind: "filter"; hasText?: Matcher; has?: LocatorStep[] }
  | { kind: "index"; index: number };

type BrowserResponseRecord = {
  sequence: number;
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  method: string;
  postData?: string;
};

const remotePages = new WeakMap<object, MimikaRemotePage>();

export function createMimikaRemotePage(input: {
  client: MimikaBrowserGatewayClient;
  origin: string;
  tabHandle: MimikaBrowserTabHandle;
  timeoutMs: number;
  initialUrl: string;
}): PlaywrightPage {
  const remote = new MimikaRemotePage(input);
  const page = remote as unknown as PlaywrightPage;
  remotePages.set(page as unknown as object, remote);
  return page;
}

export async function disposeMimikaRemotePage(page: PlaywrightPage): Promise<void> {
  await remotePages.get(page as unknown as object)?.dispose();
  remotePages.delete(page as unknown as object);
}

export function buildMimikaPageScript(request: Record<string, unknown>, origin: string): string {
  return `const runtime = (${mimikaPageRuntime.toString()}); return await runtime(${JSON.stringify(request)}, ${JSON.stringify(origin)});`;
}

class MimikaRemotePage {
  readonly client: MimikaBrowserGatewayClient;
  readonly origin: string;
  readonly tabHandle: MimikaBrowserTabHandle;
  readonly timeoutMs: number;
  readonly keyboard: {
    press: (key: string) => Promise<void>;
    type: (text: string, options?: { delay?: number }) => Promise<void>;
  };
  readonly mouse: { wheel: (deltaX: number, deltaY: number) => Promise<void> };
  #responseHandlers = new Set<(response: PlaywrightResponse) => void>();
  #responseTimer?: ReturnType<typeof setInterval>;
  #responseCursor = 0;
  #responsePolling = false;
  #lastUrl: string;

  constructor(input: {
    client: MimikaBrowserGatewayClient;
    origin: string;
    tabHandle: MimikaBrowserTabHandle;
    timeoutMs: number;
    initialUrl: string;
  }) {
    this.client = input.client;
    this.origin = normalizeMimikaBrowserOrigin(input.origin);
    this.tabHandle = input.tabHandle;
    this.timeoutMs = Math.max(1_000, input.timeoutMs);
    this.#lastUrl = input.initialUrl;
    this.keyboard = {
      press: async (key) => {
        await this.action({ action: "browser_keyboard", keyboard_action: "press", key });
      },
      type: async (text, options = {}) => {
        await this.action({
          action: "browser_keyboard",
          keyboard_action: "type",
          text,
          ...(options.delay ? { typing_delay: Math.max(0, Math.round(options.delay)) } : {}),
        });
      },
    };
    this.mouse = {
      wheel: async (deltaX, deltaY) => {
        await this.execute({ op: "wheel", deltaX, deltaY });
      },
    };
  }

  locator(selector: string, options: { hasText?: string | RegExp; has?: PlaywrightLocator } = {}): PlaywrightLocator {
    const steps: LocatorStep[] = [{ kind: "css", selector }];
    const filter = locatorFilter(options);
    if (filter) steps.push(filter);
    return new MimikaRemoteLocator(this, steps) as unknown as PlaywrightLocator;
  }

  getByText(text: string | RegExp, options: { exact?: boolean } = {}): PlaywrightLocator {
    return new MimikaRemoteLocator(this, [{ kind: "text", matcher: matcher(text, options.exact) }]) as unknown as PlaywrightLocator;
  }

  getByLabel(text: string | RegExp, options: { exact?: boolean } = {}): PlaywrightLocator {
    return new MimikaRemoteLocator(this, [{ kind: "label", matcher: matcher(text, options.exact) }]) as unknown as PlaywrightLocator;
  }

  getByRole(role: string, options: { name?: string | RegExp; exact?: boolean } = {}): PlaywrightLocator {
    return new MimikaRemoteLocator(this, [{
      kind: "role",
      role,
      ...(options.name !== undefined ? { name: matcher(options.name, options.exact) } : {}),
    }]) as unknown as PlaywrightLocator;
  }

  url(): string {
    return this.#lastUrl;
  }

  async currentUrl(): Promise<string> {
    this.#lastUrl = String(await this.execute({ op: "url" }));
    return this.#lastUrl;
  }

  async goto(url: string, options: { timeout?: number; waitUntil?: string } = {}): Promise<null> {
    const target = new URL(url);
    if (target.origin !== this.origin) {
      throw scopeError(this.origin, target.origin);
    }
    await this.action({
      action: "browser_navigate",
      url: target.href,
      timeout: Math.max(1, Math.round(options.timeout ?? Math.min(this.timeoutMs, 30_000))),
    });
    this.#lastUrl = target.href;
    return null;
  }

  async content(): Promise<string> {
    return String(await this.execute({ op: "content" }));
  }

  async waitForTimeout(timeout: number): Promise<void> {
    await sleep(Math.max(0, timeout));
  }

  async waitForLoadState(
    state: "load" | "domcontentloaded" | "networkidle" = "load",
    options: { timeout?: number } = {},
  ): Promise<void> {
    const expected = state === "domcontentloaded" ? ["interactive", "complete"] : ["complete"];
    await pollUntil(async () => expected.includes(String(await this.execute({ op: "readyState" }))), {
      timeoutMs: options.timeout ?? this.timeoutMs,
      message: `Timed out waiting for Mimika browser load state ${state}.`,
    });
  }

  async evaluate<T, Arg = unknown>(pageFunction: ((arg: Arg) => T | Promise<T>) | string, arg?: Arg): Promise<T> {
    const source = typeof pageFunction === "string" ? pageFunction : pageFunction.toString();
    return await this.execute({ op: "evaluate", source, hasArg: arguments.length > 1, arg }) as T;
  }

  async waitForFunction<Arg = unknown>(
    pageFunction: ((arg: Arg) => unknown) | string,
    arg?: Arg,
    options: { timeout?: number; polling?: number } = {},
  ): Promise<unknown> {
    const source = typeof pageFunction === "string" ? pageFunction : pageFunction.toString();
    let value: unknown;
    await pollUntil(async () => {
      value = await this.execute({ op: "evaluate", source, hasArg: arguments.length > 1, arg });
      return Boolean(value);
    }, {
      timeoutMs: options.timeout ?? this.timeoutMs,
      intervalMs: typeof options.polling === "number" ? options.polling : 200,
      message: "Timed out waiting for a Mimika browser page condition.",
    });
    return value;
  }

  async waitForResponse(
    predicate: string | RegExp | ((response: PlaywrightResponse) => boolean | Promise<boolean>),
    options: { timeout?: number } = {},
  ): Promise<PlaywrightResponse> {
    await this.execute({ op: "installResponseCapture" });
    const start = Number(await this.execute({ op: "responseSequence" })) || 0;
    let matched: PlaywrightResponse | undefined;
    await pollUntil(async () => {
      const records = await this.responseRecords(start);
      for (const record of records) {
        const response = new MimikaRemoteResponse(record) as unknown as PlaywrightResponse;
        const accepted = typeof predicate === "function"
          ? await predicate(response)
          : predicate instanceof RegExp
            ? predicate.test(record.url)
            : record.url === predicate;
        if (accepted) {
          matched = response;
          return true;
        }
      }
      return false;
    }, {
      timeoutMs: options.timeout ?? this.timeoutMs,
      intervalMs: 150,
      message: "Timed out waiting for a response in the Mimika browser tab.",
    });
    return matched!;
  }

  context(): PlaywrightBrowserContext {
    return {
      cookies: async () => (await this.client.exportOriginSession(this.origin, this.tabHandle)).cookies,
    } as unknown as PlaywrightBrowserContext;
  }

  on(event: string, handler: (response: PlaywrightResponse) => void): this {
    if (event === "response") {
      this.#responseHandlers.add(handler);
      void this.startResponsePolling();
    }
    return this;
  }

  off(event: string, handler: (response: PlaywrightResponse) => void): this {
    if (event === "response") {
      this.#responseHandlers.delete(handler);
      if (this.#responseHandlers.size === 0 && this.#responseTimer) {
        clearInterval(this.#responseTimer);
        this.#responseTimer = undefined;
      }
    }
    return this;
  }

  async dispose(): Promise<void> {
    if (this.#responseTimer) clearInterval(this.#responseTimer);
    this.#responseTimer = undefined;
    this.#responseHandlers.clear();
  }

  async execute(request: Record<string, unknown>): Promise<unknown> {
    const script = buildMimikaPageScript(request, this.origin);
    const result = await this.action({ action: "browser_script", script });
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch (error) {
      throw new MikaCliError(
        "MIMIKA_BROWSER_INVALID_RESPONSE",
        "Mimika's managed Page facade returned a non-JSON result.",
        { cause: error, details: { operation: request.op } },
      );
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      (parsed as Record<string, unknown>).__mimikaMikaPage !== 1) {
      throw new MikaCliError(
        "MIMIKA_BROWSER_INVALID_RESPONSE",
        "Mimika's managed Page facade returned an invalid result envelope.",
        { details: { operation: request.op } },
      );
    }
    const envelope = parsed as Record<string, unknown>;
    if (typeof envelope.currentUrl === "string" && new URL(envelope.currentUrl).origin === this.origin) {
      this.#lastUrl = envelope.currentUrl;
    }
    return envelope.value;
  }

  async action(payload: Record<string, unknown>) {
    return this.client.runPageAction(this.origin, this.tabHandle, payload);
  }

  private async responseRecords(after: number): Promise<BrowserResponseRecord[]> {
    const value = await this.execute({ op: "responses", after });
    return Array.isArray(value)
      ? value.filter(isBrowserResponseRecord)
      : [];
  }

  private async startResponsePolling(): Promise<void> {
    if (this.#responseTimer || this.#responsePolling) return;
    this.#responsePolling = true;
    try {
      await this.execute({ op: "installResponseCapture" });
      this.#responseCursor = Number(await this.execute({ op: "responseSequence" })) || 0;
      this.#responseTimer = setInterval(() => void this.dispatchResponseEvents(), 200);
      this.#responseTimer.unref?.();
    } finally {
      this.#responsePolling = false;
    }
  }

  private async dispatchResponseEvents(): Promise<void> {
    if (this.#responsePolling || this.#responseHandlers.size === 0) return;
    this.#responsePolling = true;
    try {
      const records = await this.responseRecords(this.#responseCursor);
      for (const record of records) {
        this.#responseCursor = Math.max(this.#responseCursor, record.sequence);
        const response = new MimikaRemoteResponse(record) as unknown as PlaywrightResponse;
        for (const handler of this.#responseHandlers) handler(response);
      }
    } catch {
      // The owning action observes its own timeout/error; event polling never
      // turns a successful provider result into an unhandled rejection.
    } finally {
      this.#responsePolling = false;
    }
  }
}

class MimikaRemoteLocator {
  constructor(
    readonly page: MimikaRemotePage,
    readonly steps: LocatorStep[],
  ) {}

  locator(selector: string, options: { hasText?: string | RegExp; has?: PlaywrightLocator } = {}): PlaywrightLocator {
    const steps = [...this.steps, { kind: "css", selector } as LocatorStep];
    const filter = locatorFilter(options);
    if (filter) steps.push(filter);
    return new MimikaRemoteLocator(this.page, steps) as unknown as PlaywrightLocator;
  }

  getByText(text: string | RegExp, options: { exact?: boolean } = {}): PlaywrightLocator {
    return new MimikaRemoteLocator(this.page, [
      ...this.steps,
      { kind: "text", matcher: matcher(text, options.exact) },
    ]) as unknown as PlaywrightLocator;
  }

  filter(options: { hasText?: string | RegExp; has?: PlaywrightLocator }): PlaywrightLocator {
    const filter = locatorFilter(options);
    return new MimikaRemoteLocator(this.page, filter ? [...this.steps, filter] : [...this.steps]) as unknown as PlaywrightLocator;
  }

  first(): PlaywrightLocator {
    return this.nth(0);
  }

  last(): PlaywrightLocator {
    return this.nth(-1);
  }

  nth(index: number): PlaywrightLocator {
    return new MimikaRemoteLocator(this.page, [...this.steps, { kind: "index", index }]) as unknown as PlaywrightLocator;
  }

  async count(): Promise<number> {
    return Number(await this.run("count")) || 0;
  }

  async isVisible(): Promise<boolean> {
    return Boolean(await this.run("isVisible"));
  }

  async isChecked(): Promise<boolean> {
    return Boolean(await this.run("isChecked"));
  }

  async innerText(): Promise<string> {
    return String(await this.run("innerText") ?? "");
  }

  async textContent(): Promise<string | null> {
    const value = await this.run("textContent");
    return value == null ? null : String(value);
  }

  async inputValue(): Promise<string> {
    return String(await this.run("inputValue") ?? "");
  }

  async getAttribute(name: string): Promise<string | null> {
    const value = await this.run("getAttribute", { name });
    return value == null ? null : String(value);
  }

  async boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null> {
    const value = await this.run("boundingBox");
    return value && typeof value === "object" ? value as { x: number; y: number; width: number; height: number } : null;
  }

  async click(options: Record<string, unknown> = {}): Promise<void> {
    await this.run("click", { options });
  }

  async fill(value: string): Promise<void> {
    await this.run("fill", { value });
  }

  async check(): Promise<void> {
    await this.run("check");
  }

  async hover(): Promise<void> {
    await this.run("hover");
  }

  async dispatchEvent(type: string, eventInit: Record<string, unknown> = {}): Promise<void> {
    await this.run("dispatchEvent", { type, eventInit });
  }

  async scrollIntoViewIfNeeded(): Promise<void> {
    await this.run("scrollIntoView");
  }

  async selectOption(
    values: string | { value?: string; label?: string; index?: number } | Array<string | { value?: string; label?: string; index?: number }>,
  ): Promise<string[]> {
    const selected = await this.run("selectOption", { values: Array.isArray(values) ? values : [values] });
    return Array.isArray(selected) ? selected.map(String) : [];
  }

  async setInputFiles(files: string | string[]): Promise<void> {
    const marker = `mika-${randomBytes(12).toString("hex")}`;
    const selector = `[data-mimika-mikacli-upload="${marker}"]`;
    await this.run("mark", { marker });
    try {
      await this.page.action({
        action: "browser_file_upload",
        selector,
        files: Array.isArray(files) ? files : [files],
      });
    } finally {
      await this.page.execute({ op: "clearMark", marker }).catch(() => {});
    }
  }

  async waitFor(options: { state?: "attached" | "detached" | "visible" | "hidden"; timeout?: number } = {}): Promise<void> {
    const state = options.state ?? "visible";
    await pollUntil(async () => {
      const count = await this.count();
      const visible = count > 0 && await this.isVisible();
      return state === "attached" ? count > 0
        : state === "detached" ? count === 0
          : state === "hidden" ? count === 0 || !visible
            : visible;
    }, {
      timeoutMs: options.timeout ?? this.page.timeoutMs,
      message: `Timed out waiting for locator to become ${state} in Mimika's browser.`,
    });
  }

  private run(op: string, extra: Record<string, unknown> = {}): Promise<unknown> {
    return this.page.execute({ op: "locator", locatorOp: op, steps: this.steps, ...extra });
  }
}

class MimikaRemoteRequest {
  constructor(readonly record: BrowserResponseRecord) {}
  method(): string { return this.record.method; }
  postData(): string | null { return this.record.postData ?? null; }
  url(): string { return this.record.url; }
}

class MimikaRemoteResponse {
  constructor(readonly record: BrowserResponseRecord) {}
  url(): string { return this.record.url; }
  status(): number { return this.record.status; }
  statusText(): string { return this.record.statusText; }
  ok(): boolean { return this.record.status >= 200 && this.record.status < 400; }
  headers(): Record<string, string> { return { ...this.record.headers }; }
  request(): PlaywrightRequest { return new MimikaRemoteRequest(this.record) as unknown as PlaywrightRequest; }
  async text(): Promise<string> { return this.record.body; }
  async json(): Promise<unknown> { return JSON.parse(this.record.body); }
  async body(): Promise<Buffer> { return Buffer.from(this.record.body); }
}

function locatorFilter(options: { hasText?: string | RegExp; has?: PlaywrightLocator }): LocatorStep | undefined {
  const has = options.has instanceof MimikaRemoteLocator ? options.has.steps : undefined;
  if (options.hasText === undefined && !has) return undefined;
  return {
    kind: "filter",
    ...(options.hasText !== undefined ? { hasText: matcher(options.hasText) } : {}),
    ...(has ? { has } : {}),
  };
}

function matcher(value: string | RegExp, exact = false): Matcher {
  return value instanceof RegExp
    ? { kind: "regex", source: value.source, flags: value.flags }
    : { kind: "string", value, exact };
}

function isBrowserResponseRecord(value: unknown): value is BrowserResponseRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.sequence === "number" && typeof record.url === "string" &&
    typeof record.status === "number" && typeof record.statusText === "string" &&
    typeof record.body === "string" && typeof record.method === "string";
}

async function pollUntil(
  predicate: () => Promise<boolean>,
  input: { timeoutMs: number; intervalMs?: number; message: string },
): Promise<void> {
  const deadline = Date.now() + Math.max(1, input.timeoutMs);
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(Math.min(input.intervalMs ?? 150, Math.max(1, deadline - Date.now())));
  }
  throw new MikaCliError("MIMIKA_BROWSER_PAGE_TIMEOUT", input.message, { cause: lastError });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scopeError(expected: string, actual: string): MikaCliError {
  return new MikaCliError(
    "MIMIKA_BROWSER_SCOPE_VIOLATION",
    "Managed browser navigation cannot leave the exact origin approved for this provider action.",
    { details: { expectedOrigin: expected, actualOrigin: actual } },
  );
}

// This function is serialized and evaluated inside the already-selected
// Mimika tab. It deliberately has no closure dependencies.
async function mimikaPageRuntime(request: any, expectedOrigin: string): Promise<any> {
  if (location.origin !== expectedOrigin) throw new Error("MIMIKA_ORIGIN_MISMATCH");

  const normalize = (value: unknown) => String(value ?? "").replace(/\s+/gu, " ").trim();
  const matches = (value: unknown, spec: any) => {
    const text = normalize(value);
    if (!spec) return true;
    if (spec.kind === "regex") return new RegExp(spec.source, spec.flags).test(text);
    return spec.exact ? text === spec.value : text.toLowerCase().includes(String(spec.value).toLowerCase());
  };
  const implicitRole = (element: Element) => {
    const explicit = element.getAttribute("role");
    if (explicit) return explicit;
    const tag = element.tagName.toLowerCase();
    if (tag === "button") return "button";
    if (tag === "a" && element.hasAttribute("href")) return "link";
    if (tag === "textarea") return "textbox";
    if (tag === "select") return "combobox";
    if (tag === "option") return "option";
    if (tag === "input") {
      const type = (element.getAttribute("type") || "text").toLowerCase();
      if (["button", "submit", "reset"].includes(type)) return "button";
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      return "textbox";
    }
    return "";
  };
  const accessibleName = (element: Element) => normalize(
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    (element instanceof HTMLInputElement ? element.value : "") ||
    (element as HTMLElement).innerText ||
    element.textContent,
  );
  const cssQuery = (root: ParentNode, selector: string): Element[] => {
    if (selector.startsWith("xpath=")) {
      const snapshot = document.evaluate(selector.slice(6), root as Node, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      return Array.from({ length: snapshot.snapshotLength }, (_, index) => snapshot.snapshotItem(index)).filter(
        (node): node is Element => node instanceof Element,
      );
    }
    const textSelector = selector.match(/^text=\/(.*)\/([a-z]*)$/u);
    if (textSelector) {
      const expression = new RegExp(textSelector[1]!, textSelector[2]!);
      return Array.from(root.querySelectorAll("*")).filter((element) => expression.test(normalize((element as HTMLElement).innerText)));
    }
    const hasText = selector.match(/:has-text\((['"])(.*?)\1\)/u);
    const base = hasText ? selector.replace(hasText[0], "") || "*" : selector;
    const elements = Array.from(root.querySelectorAll(base));
    return hasText ? elements.filter((element) => normalize((element as HTMLElement).innerText).includes(hasText[2]!)) : elements;
  };
  const runSteps = (steps: any[], roots: Array<Document | Element> = [document]): Element[] => {
    let current: Element[] = roots.filter((root): root is Element => root instanceof Element);
    let initialRoots: Array<Document | Element> = roots;
    for (const step of steps || []) {
      if (["css", "text", "label", "role"].includes(step.kind)) {
        const searchRoots = current.length > 0 ? current : initialRoots;
        const next: Element[] = [];
        for (const root of searchRoots) {
          if (step.kind === "css") next.push(...cssQuery(root, step.selector));
          if (step.kind === "text") {
            next.push(...Array.from(root.querySelectorAll("*")).filter((element) => matches((element as HTMLElement).innerText, step.matcher)));
          }
          if (step.kind === "role") {
            next.push(...Array.from(root.querySelectorAll("*")).filter((element) =>
              implicitRole(element) === step.role && (!step.name || matches(accessibleName(element), step.name))));
          }
          if (step.kind === "label") {
            for (const label of Array.from(root.querySelectorAll("label"))) {
              if (!matches((label as HTMLElement).innerText, step.matcher)) continue;
              const control = label.control || (label.htmlFor ? document.getElementById(label.htmlFor) : label.querySelector("input,textarea,select,button"));
              if (control instanceof Element) next.push(control);
            }
            next.push(...Array.from(root.querySelectorAll("[aria-label]")).filter((element) => matches(element.getAttribute("aria-label"), step.matcher)));
          }
        }
        current = Array.from(new Set(next));
        initialRoots = current;
        continue;
      }
      if (step.kind === "filter") {
        current = current.filter((element) =>
          (!step.hasText || matches((element as HTMLElement).innerText, step.hasText)) &&
          (!step.has || runSteps(step.has, [element]).length > 0));
      }
      if (step.kind === "index") {
        const index = step.index < 0 ? current.length + step.index : step.index;
        current = index >= 0 && index < current.length ? [current[index]!] : [];
      }
    }
    return current;
  };
  const visible = (element: Element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
  };
  const envelope = (value: unknown) => ({ __mimikaMikaPage: 1, currentUrl: location.href, value });

  if (request.op === "url") return envelope(location.href);
  if (request.op === "content") return envelope(document.documentElement.outerHTML);
  if (request.op === "readyState") return envelope(document.readyState);
  if (request.op === "wheel") {
    scrollBy(Number(request.deltaX) || 0, Number(request.deltaY) || 0);
    return envelope(null);
  }
  if (request.op === "evaluate") {
    const fn = (0, eval)(`(${request.source})`);
    return envelope(await fn(request.hasArg ? request.arg : undefined));
  }
  const captureState = () => {
    const global = globalThis as any;
    if (global.__mimikaMikaResponses) return global.__mimikaMikaResponses;
    const state = global.__mimikaMikaResponses = { sequence: 0, items: [] as any[], installed: false, resources: new Set<string>() };
    const push = (entry: any) => {
      state.sequence += 1;
      state.items.push({ sequence: state.sequence, headers: {}, body: "", statusText: "", method: "GET", ...entry });
      if (state.items.length > 64) state.items.splice(0, state.items.length - 64);
    };
    if (!state.installed) {
      state.installed = true;
      const originalFetch = global.fetch.bind(global);
      global.fetch = async (input: any, init: any = {}) => {
        const response = await originalFetch(input, init);
        const clone = response.clone();
        const headers: Record<string, string> = {};
        clone.headers.forEach((value: string, key: string) => { headers[key] = value; });
        void clone.text().then((body: string) => push({
          url: clone.url,
          status: clone.status,
          statusText: clone.statusText,
          headers,
          body: body.slice(0, 512 * 1024),
          method: String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase(),
          postData: typeof init.body === "string" ? init.body.slice(0, 128 * 1024) : undefined,
        })).catch(() => {});
        return response;
      };
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...rest: any[]) {
        (this as any).__mikaRequest = { method: String(method).toUpperCase(), url: new URL(String(url), location.href).href };
        return (originalOpen as any).apply(this, [method, url, ...rest]);
      };
      XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
        const xhr = this;
        xhr.addEventListener("loadend", () => {
          const requestInfo = (xhr as any).__mikaRequest || {};
          const headers: Record<string, string> = {};
          for (const line of String(xhr.getAllResponseHeaders() || "").split(/\r?\n/u)) {
            const split = line.indexOf(":");
            if (split > 0) headers[line.slice(0, split).trim().toLowerCase()] = line.slice(split + 1).trim();
          }
          push({
            url: xhr.responseURL || requestInfo.url || "",
            status: xhr.status,
            statusText: xhr.statusText,
            headers,
            body: typeof xhr.responseText === "string" ? xhr.responseText.slice(0, 512 * 1024) : "",
            method: requestInfo.method || "GET",
            postData: typeof body === "string" ? body.slice(0, 128 * 1024) : undefined,
          });
        }, { once: true });
        return originalSend.call(this, body as any);
      };
    }
    for (const entry of performance.getEntriesByType("resource") as PerformanceResourceTiming[]) {
      if (state.resources.has(entry.name)) continue;
      state.resources.add(entry.name);
      push({ url: entry.name, status: 200, method: "GET" });
    }
    return state;
  };
  if (request.op === "installResponseCapture") {
    captureState();
    return envelope(true);
  }
  if (request.op === "responseSequence") return envelope(captureState().sequence);
  if (request.op === "responses") return envelope(captureState().items.filter((entry: any) => entry.sequence > Number(request.after || 0)));
  if (request.op === "clearMark") {
    for (const element of document.querySelectorAll(`[data-mimika-mikacli-upload="${CSS.escape(String(request.marker))}"]`)) {
      element.removeAttribute("data-mimika-mikacli-upload");
    }
    return envelope(null);
  }
  if (request.op !== "locator") throw new Error("Unsupported managed Page operation");

  const elements = runSteps(request.steps || []);
  const element = elements[0];
  switch (request.locatorOp) {
    case "count": return envelope(elements.length);
    case "isVisible": return envelope(Boolean(element && visible(element)));
    case "isChecked": return envelope(Boolean(element && "checked" in element && (element as HTMLInputElement).checked));
    case "innerText": return envelope(element ? (element as HTMLElement).innerText : "");
    case "textContent": return envelope(element?.textContent ?? null);
    case "inputValue": return envelope(element && "value" in element ? String((element as HTMLInputElement).value) : "");
    case "getAttribute": return envelope(element?.getAttribute(String(request.name)) ?? null);
    case "boundingBox": {
      if (!element) return envelope(null);
      const rect = element.getBoundingClientRect();
      return envelope({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }
    case "scrollIntoView": {
      if (!element) throw new Error("Locator did not resolve an element");
      element.scrollIntoView({ block: "center", inline: "center" });
      return envelope(null);
    }
    case "hover": {
      if (!element) throw new Error("Locator did not resolve an element");
      element.scrollIntoView({ block: "center", inline: "center" });
      for (const type of ["pointerover", "mouseover", "mouseenter"]) element.dispatchEvent(new MouseEvent(type, { bubbles: true }));
      return envelope(null);
    }
    case "click": {
      if (!(element instanceof HTMLElement)) throw new Error("Locator did not resolve a clickable element");
      element.scrollIntoView({ block: "center", inline: "center" });
      element.focus();
      element.click();
      return envelope(null);
    }
    case "fill": {
      if (!(element instanceof HTMLElement)) throw new Error("Locator did not resolve a fillable element");
      element.focus();
      const value = String(request.value ?? "");
      if (element instanceof HTMLInputElement) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
      } else if (element instanceof HTMLTextAreaElement) {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(element, value);
      } else {
        element.textContent = value;
      }
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return envelope(null);
    }
    case "check": {
      if (!(element instanceof HTMLInputElement)) throw new Error("Locator did not resolve a checkbox or radio");
      if (!element.checked) element.click();
      return envelope(null);
    }
    case "dispatchEvent": {
      if (!element) throw new Error("Locator did not resolve an element");
      const event = new Event(String(request.type), { bubbles: true, cancelable: true });
      Object.assign(event, request.eventInit || {});
      element.dispatchEvent(event);
      return envelope(null);
    }
    case "selectOption": {
      if (!(element instanceof HTMLSelectElement)) throw new Error("Locator did not resolve a select element");
      const values = Array.isArray(request.values) ? request.values : [];
      const selected: string[] = [];
      for (const option of Array.from(element.options)) option.selected = false;
      for (const choice of values) {
        const option = typeof choice === "string"
          ? Array.from(element.options).find((entry) => entry.value === choice)
          : typeof choice?.index === "number"
            ? element.options[choice.index]
            : Array.from(element.options).find((entry) =>
              choice?.value !== undefined ? entry.value === choice.value : normalize(entry.label) === normalize(choice?.label));
        if (option) {
          option.selected = true;
          selected.push(option.value);
        }
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return envelope(selected);
    }
    case "mark": {
      if (!element) throw new Error("Locator did not resolve a file input");
      element.setAttribute("data-mimika-mikacli-upload", String(request.marker));
      return envelope(null);
    }
    default: throw new Error("Unsupported managed locator operation");
  }
}
