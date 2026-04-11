import { CalendarApiClient } from "./client.js";
import { BaseGooglePlatformAdapter } from "../shared/base.js";

import type { AdapterActionResult } from "../../../types.js";

export class CalendarAdapter extends BaseGooglePlatformAdapter {
  readonly platform = "calendar" as const;
  protected readonly defaultScopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar",
  ] as const;

  async calendars(input: { account?: string; limit?: number } = {}): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const calendars = await this.createClient(active.accessToken).listCalendars({
      limit: input.limit,
    });

    return this.buildActionResult({
      account: active.account,
      action: "calendars",
      message: `Loaded ${calendars.length} Google Calendar entr${calendars.length === 1 ? "y" : "ies"}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        calendars,
      },
    });
  }

  async calendar(input: { account?: string; calendarId: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const calendar = await this.createClient(active.accessToken).getCalendar(input.calendarId);

    return this.buildActionResult({
      account: active.account,
      action: "calendar",
      message: `Loaded Google Calendar ${input.calendarId}.`,
      sessionPath: active.path,
      user: active.user,
      id: calendar.id,
      url: calendar.webViewLink,
      data: {
        calendar,
      },
    });
  }

  async events(input: {
    account?: string;
    calendarId?: string;
    query?: string;
    limit?: number;
    timeMin?: string;
    timeMax?: string;
  }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const calendarId = input.calendarId?.trim() || "primary";
    const events = await this.createClient(active.accessToken).listEvents({
      calendarId,
      query: input.query,
      limit: input.limit,
      timeMin: input.timeMin,
      timeMax: input.timeMax,
    });

    return this.buildActionResult({
      account: active.account,
      action: "events",
      message: `Loaded ${events.length} Google Calendar event${events.length === 1 ? "" : "s"} from ${calendarId}.`,
      sessionPath: active.path,
      user: active.user,
      data: {
        calendarId,
        ...(input.timeMin ? { timeMin: input.timeMin } : {}),
        ...(input.timeMax ? { timeMax: input.timeMax } : {}),
        events,
      },
    });
  }

  async today(input: { account?: string; calendarId?: string; limit?: number }): Promise<AdapterActionResult> {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const result = await this.events({
      account: input.account,
      calendarId: input.calendarId,
      limit: input.limit,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
    });

    return {
      ...result,
      action: "today",
      message: `Loaded today's Google Calendar events from ${input.calendarId?.trim() || "primary"}.`,
      data: {
        ...(result.data ?? {}),
        date: start.toISOString().slice(0, 10),
      },
    };
  }

  async event(input: { account?: string; calendarId?: string; eventId: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const calendarId = input.calendarId?.trim() || "primary";
    const event = await this.createClient(active.accessToken).getEvent({
      calendarId,
      eventId: input.eventId,
    });

    return this.buildActionResult({
      account: active.account,
      action: "event",
      message: `Loaded Google Calendar event ${input.eventId}.`,
      sessionPath: active.path,
      user: active.user,
      id: event.id,
      url: event.webViewLink,
      data: {
        calendarId,
        event,
      },
    });
  }

  async createEvent(input: {
    account?: string;
    calendarId?: string;
    summary: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
    attendees?: string[];
    timeZone?: string;
  }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const calendarId = input.calendarId?.trim() || "primary";
    const event = await this.createClient(active.accessToken).createEvent({
      ...input,
      calendarId,
    });

    return this.buildActionResult({
      account: active.account,
      action: "create-event",
      message: `Created Google Calendar event ${input.summary}.`,
      sessionPath: active.path,
      user: active.user,
      id: event.id,
      url: event.webViewLink,
      data: {
        calendarId,
        event,
      },
    });
  }

  async updateEvent(input: {
    account?: string;
    calendarId?: string;
    eventId: string;
    summary?: string;
    start?: string;
    end?: string;
    description?: string;
    location?: string;
    attendees?: string[];
    timeZone?: string;
    status?: string;
  }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const calendarId = input.calendarId?.trim() || "primary";
    const event = await this.createClient(active.accessToken).updateEvent({
      ...input,
      calendarId,
    });

    return this.buildActionResult({
      account: active.account,
      action: "update-event",
      message: `Updated Google Calendar event ${input.eventId}.`,
      sessionPath: active.path,
      user: active.user,
      id: event.id,
      url: event.webViewLink,
      data: {
        calendarId,
        event,
      },
    });
  }

  async deleteEvent(input: { account?: string; calendarId?: string; eventId: string }): Promise<AdapterActionResult> {
    const active = await this.ensureActiveConnection(input.account);
    const calendarId = input.calendarId?.trim() || "primary";
    await this.createClient(active.accessToken).deleteEvent({
      calendarId,
      eventId: input.eventId,
    });

    return this.buildActionResult({
      account: active.account,
      action: "delete-event",
      message: `Deleted Google Calendar event ${input.eventId}.`,
      sessionPath: active.path,
      user: active.user,
      id: input.eventId,
      data: {
        calendarId,
        event: {
          id: input.eventId,
          status: "deleted",
        },
      },
    });
  }

  private createClient(accessToken: string): CalendarApiClient {
    return new CalendarApiClient(accessToken, this.fetchImpl);
  }
}

export const calendarAdapter = new CalendarAdapter();
