import { MikaCliError } from "../../errors.js";
import { getPlatformDisplayName } from "../../platforms/config.js";
import {
  runBrowserActionPlan,
  type BrowserActionPlanStep,
  type BrowserActionSource,
} from "../../utils/browser-cookie-login.js";

import type { AdapterActionResult, Platform } from "../../types.js";
import type { Page as PlaywrightPage } from "playwright-core";

export type BrowserActionMode = "required" | "preferred" | "fallback";
export type BrowserActionStrategyPreset =
  | "headless-only"
  | "profile-only"
  | "shared-only"
  | "headless-then-shared"
  | "headless-then-profile-then-shared";

export interface BrowserActionExecutionMetadata {
  runtime: "browser";
  mode: BrowserActionMode;
  source: BrowserActionSource;
  strategy: BrowserActionStrategyPreset | "custom";
  targetUrl: string;
  timeoutSeconds: number;
}

export interface BrowserActionExecution<T> {
  value: T;
  browser: BrowserActionExecutionMetadata;
}

export interface BrowserActionRuntimeInput<T> {
  platform: Platform;
  action: string;
  actionLabel?: string;
  targetUrl: string;
  timeoutSeconds?: number;
  initialCookies?: unknown[];
  headless?: boolean;
  profile?: string;
  userAgent?: string;
  locale?: string;
  announceLabel?: string;
  mode?: BrowserActionMode;
  strategy?: BrowserActionStrategyPreset;
  steps?: readonly BrowserActionPlanStep[];
  actionFn: (page: PlaywrightPage, source: BrowserActionSource) => Promise<T>;
}

export function resolveBrowserActionStrategySteps(
  strategy: BrowserActionStrategyPreset,
  announceLabel?: string,
): readonly BrowserActionPlanStep[] {
  switch (strategy) {
    case "headless-only":
      return [{ source: "headless" }];
    case "profile-only":
      return [{ source: "profile" }];
    case "shared-only":
      return [{
        source: "shared",
        ...(announceLabel ? { announceLabel } : {}),
      }];
    case "headless-then-shared":
      return [
        { source: "headless" },
        {
          source: "shared",
          ...(announceLabel ? { announceLabel } : {}),
        },
      ];
    case "headless-then-profile-then-shared":
      return [
        { source: "headless" },
        { source: "profile" },
        {
          source: "shared",
          ...(announceLabel ? { announceLabel } : {}),
        },
      ];
  }
}

export async function runFirstClassBrowserAction<T>(input: BrowserActionRuntimeInput<T>): Promise<BrowserActionExecution<T>> {
  const timeoutSeconds = input.timeoutSeconds ?? 60;
  const mode = input.mode ?? "required";
  const strategy = input.strategy ?? "shared-only";
  const steps = input.steps ?? resolveBrowserActionStrategySteps(strategy, input.announceLabel);

  try {
    const result = await runBrowserActionPlan<T>({
      targetUrl: input.targetUrl,
      timeoutSeconds,
      initialCookies: input.initialCookies,
      headless: input.headless,
      profile: input.profile,
      userAgent: input.userAgent,
      locale: input.locale,
      steps,
      action: input.actionFn,
    });

    return {
      value: result,
      browser: {
        runtime: "browser",
        mode,
        source: inferBrowserActionSource(steps, result),
        strategy: input.steps ? "custom" : strategy,
        targetUrl: input.targetUrl,
        timeoutSeconds,
      },
    };
  } catch (error) {
    throw normalizeBrowserActionRuntimeError(input, error);
  }
}

export function withBrowserActionMetadata<T extends AdapterActionResult>(
  result: T,
  execution: BrowserActionExecution<unknown>,
  extraData: Record<string, unknown> = {},
): T {
  return {
    ...result,
    data: {
      ...(result.data ?? {}),
      ...extraData,
      ...(typeof extraData.source === "undefined" ? { source: execution.browser.source } : {}),
      browser: execution.browser,
    },
  };
}

function inferBrowserActionSource<T>(
  steps: readonly BrowserActionPlanStep[],
  result: T,
): BrowserActionSource {
  if (result && typeof result === "object" && "source" in (result as Record<string, unknown>)) {
    const source = (result as Record<string, unknown>).source;
    if (source === "headless" || source === "profile" || source === "shared") {
      return source;
    }
  }

  if (steps.length === 1) {
    return steps[0]!.source;
  }

  return steps[steps.length - 1]?.source ?? "shared";
}

export function normalizeBrowserActionRuntimeError<T>(
  input: BrowserActionRuntimeInput<T>,
  error: unknown,
): unknown {
  if (!(error instanceof MikaCliError)) {
    return error;
  }

  if (error.code === "BROWSER_NOT_RUNNING") {
    const displayName = getPlatformDisplayName(input.platform);
    const actionLabel = input.actionLabel ?? input.action;
    return new MikaCliError(
      "BROWSER_ACTION_SHARED_REQUIRED",
      `${displayName} ${actionLabel} requires the shared MikaCLI browser to already be open. Run \`mikacli login --browser\` first and keep that browser window open.`,
      {
        cause: error,
        details: {
          platform: input.platform,
          action: input.action,
          targetUrl: input.targetUrl,
          ...(error.details ?? {}),
        },
      },
    );
  }

  if (error.code === "BROWSER_PROFILE_IN_USE") {
    const displayName = getPlatformDisplayName(input.platform);
    const actionLabel = input.actionLabel ?? input.action;
    return new MikaCliError(
      "BROWSER_ACTION_PROFILE_BUSY",
      `${displayName} ${actionLabel} could not start its invisible browser runtime because the shared MikaCLI browser profile is already open.`,
      {
        cause: error,
        details: {
          platform: input.platform,
          action: input.action,
          targetUrl: input.targetUrl,
          ...(error.details ?? {}),
        },
      },
    );
  }

  return error;
}
