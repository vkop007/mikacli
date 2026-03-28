import { AutoCliError } from "../../../errors.js";
import type { AdapterActionResult, Platform } from "../../../types.js";

type TimeLookupInput = {
  timezone?: string;
};

type ParsedTime = {
  localDatetime: string;
  utcOffset: string;
  timezone: string;
  dayOfWeek: number;
  dayOfWeekName: string;
  source: string;
  fallbackUsed: boolean;
};

export class TimeAdapter {
  readonly platform: Platform = "time";
  readonly displayName = "Time";

  async time(input: TimeLookupInput): Promise<AdapterActionResult> {
    const timezone = normalizeOptionalString(input.timezone);
    const parsed = await this.lookupTime(timezone);
    const label = parsed.timezone || timezone || "current location";

    return this.buildResult({
      action: "time",
      message: `Loaded local time for ${label}.${parsed.fallbackUsed ? " (fallback source)" : ""}`,
      data: {
        localDatetime: parsed.localDatetime,
        utcOffset: parsed.utcOffset,
        timezone: parsed.timezone,
        dayOfWeek: parsed.dayOfWeek,
        dayOfWeekName: parsed.dayOfWeekName,
        source: parsed.source,
        fallbackUsed: parsed.fallbackUsed,
      },
    });
  }

  private async lookupTime(timezone?: string): Promise<ParsedTime> {
    try {
      return await this.lookupWorldTimeApi(timezone);
    } catch (worldError) {
      try {
        return await this.lookupFallback(timezone);
      } catch (fallbackError) {
        if (worldError instanceof AutoCliError) {
          throw new AutoCliError(worldError.code, worldError.message, {
            details: {
              ...(worldError.details ?? {}),
              fallbackError: fallbackError instanceof Error ? fallbackError.message : "unknown fallback error",
            },
            cause: worldError,
          });
        }

        throw new AutoCliError("TIME_REQUEST_FAILED", "Unable to load current time from configured providers.", {
          details: {
            timezone: timezone ?? "ip",
            worldError: worldError instanceof Error ? worldError.message : "unknown",
            fallbackError: fallbackError instanceof Error ? fallbackError.message : "unknown",
          },
          cause: worldError,
        });
      }
    }
  }

  private async lookupWorldTimeApi(timezone?: string): Promise<ParsedTime> {
    const url = timezone ? buildWorldTimeApiTimezoneUrl(timezone) : "https://worldtimeapi.org/api/ip";
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: {
          accept: "application/json",
          "user-agent": "AutoCLI/1.0 (+https://github.com/)",
        },
      });
    } catch (error) {
      throw new AutoCliError("TIME_REQUEST_FAILED", "Unable to reach worldtimeapi.org.", {
        details: { timezone: timezone ?? "ip" },
        cause: error,
      });
    }

    if (!response.ok) {
      if (timezone && response.status === 404) {
        throw new AutoCliError("TIME_TIMEZONE_NOT_FOUND", `Unknown timezone "${timezone}".`, {
          details: { timezone },
        });
      }

      throw new AutoCliError("TIME_REQUEST_FAILED", `worldtimeapi.org request failed with ${response.status} ${response.statusText}.`, {
        details: {
          timezone: timezone ?? "ip",
          status: response.status,
        },
      });
    }

    const payload = await safeJson(response, "worldtimeapi.org");
    const record = asRecord(payload);
    const localDatetime = normalizeOptionalString(asString(record.datetime));
    const utcOffset = normalizeOptionalString(asString(record.utc_offset));
    const zone = normalizeOptionalString(asString(record.timezone));
    const dayOfWeek = asInteger(record.day_of_week);

    if (!localDatetime || !utcOffset || !zone || dayOfWeek === undefined) {
      throw new AutoCliError("TIME_RESPONSE_INVALID", "worldtimeapi.org response did not include expected time fields.", {
        details: {
          hasDatetime: Boolean(localDatetime),
          hasUtcOffset: Boolean(utcOffset),
          hasTimezone: Boolean(zone),
          hasDayOfWeek: dayOfWeek !== undefined,
        },
      });
    }

    return {
      localDatetime,
      utcOffset,
      timezone: zone,
      dayOfWeek,
      dayOfWeekName: dayOfWeekName(dayOfWeek),
      source: timezone ? "https://worldtimeapi.org/api/timezone/{zone}" : "https://worldtimeapi.org/api/ip",
      fallbackUsed: false,
    };
  }

  private async lookupFallback(timezone?: string): Promise<ParsedTime> {
    const zone = timezone ?? (await this.inferTimezoneFromIpWhoIs());
    const timePayload = await this.fetchTimeApiCurrent(zone);
    const offset = await this.fetchTimeApiOffset(zone);

    const dateTime = normalizeOptionalString(asString(timePayload.dateTime));
    const timeZone = normalizeOptionalString(asString(timePayload.timeZone)) ?? zone;
    const day = normalizeOptionalString(asString(timePayload.dayOfWeek));

    if (!dateTime || !timeZone || !day) {
      throw new AutoCliError("TIME_RESPONSE_INVALID", "timeapi.io response did not include expected fields.", {
        details: {
          timezone: zone,
          hasDateTime: Boolean(dateTime),
          hasTimeZone: Boolean(timeZone),
          hasDayOfWeek: Boolean(day),
        },
      });
    }

    const dayIndex = dayNameToIndex(day);
    if (dayIndex === undefined) {
      throw new AutoCliError("TIME_RESPONSE_INVALID", `Unrecognized weekday "${day}" returned by timeapi.io.`);
    }

    return {
      localDatetime: dateTime,
      utcOffset: offset,
      timezone: timeZone,
      dayOfWeek: dayIndex,
      dayOfWeekName: dayOfWeekName(dayIndex),
      source: "https://timeapi.io/api/Time/current/zone",
      fallbackUsed: true,
    };
  }

  private async inferTimezoneFromIpWhoIs(): Promise<string> {
    let response: Response;
    try {
      response = await fetch("https://ipwho.is/", {
        signal: AbortSignal.timeout(10000),
        headers: {
          accept: "application/json",
          "user-agent": "AutoCLI/1.0 (+https://github.com/)",
        },
      });
    } catch (error) {
      throw new AutoCliError("TIME_REQUEST_FAILED", "Unable to infer timezone from IP fallback provider.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new AutoCliError("TIME_REQUEST_FAILED", `ipwho.is fallback failed with ${response.status} ${response.statusText}.`);
    }

    const payload = await safeJson(response, "ipwho.is");
    const timezone = normalizeOptionalString(asString(asRecord(asRecord(payload).timezone).id));
    if (!timezone) {
      throw new AutoCliError("TIME_RESPONSE_INVALID", "ipwho.is fallback did not include timezone metadata.");
    }

    return timezone;
  }

  private async fetchTimeApiCurrent(timezone: string): Promise<Record<string, unknown>> {
    const url = new URL("https://timeapi.io/api/Time/current/zone");
    url.searchParams.set("timeZone", timezone);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: {
        accept: "application/json",
        "user-agent": "AutoCLI/1.0 (+https://github.com/)",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new AutoCliError("TIME_TIMEZONE_NOT_FOUND", `Unknown timezone "${timezone}".`, {
          details: { timezone },
        });
      }
      throw new AutoCliError("TIME_REQUEST_FAILED", `timeapi.io current time request failed with ${response.status} ${response.statusText}.`);
    }

    return asRecord(await safeJson(response, "timeapi.io"));
  }

  private async fetchTimeApiOffset(timezone: string): Promise<string> {
    const url = new URL("https://timeapi.io/api/TimeZone/zone");
    url.searchParams.set("timeZone", timezone);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: {
        accept: "application/json",
        "user-agent": "AutoCLI/1.0 (+https://github.com/)",
      },
    });

    if (!response.ok) {
      return "+00:00";
    }

    const payload = asRecord(await safeJson(response, "timeapi.io"));
    const seconds = asInteger(asRecord(payload.currentUtcOffset).seconds);
    if (seconds === undefined) {
      return "+00:00";
    }

    return formatOffset(seconds);
  }

  private buildResult(input: {
    action: string;
    message: string;
    data: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: input.action,
      message: input.message,
      data: input.data,
    };
  }
}

export const timeAdapter = new TimeAdapter();

function buildWorldTimeApiTimezoneUrl(timezone: string): string {
  const normalized = timezone
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  const encodedPath = normalized
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://worldtimeapi.org/api/timezone/${encodedPath}`;
}

function dayOfWeekName(day: number): string {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[day] ?? "Unknown";
}

function dayNameToIndex(dayName: string): number | undefined {
  const normalized = dayName.trim().toLowerCase();
  const mapping: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  return mapping[normalized];
}

function formatOffset(totalSeconds: number): string {
  const sign = totalSeconds >= 0 ? "+" : "-";
  const absolute = Math.abs(totalSeconds);
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

async function safeJson(response: Response, label: string): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new AutoCliError("TIME_RESPONSE_INVALID", `${label} returned invalid JSON.`, {
      cause: error,
    });
  }
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
