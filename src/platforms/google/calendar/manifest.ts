import { Command } from "commander";

import { runGoogleAction, parseGoogleScopes, parseOptionalLimit, parseTimeoutSeconds } from "../shared/command.js";
import { calendarAdapter } from "./adapter.js";

import type { PlatformCommandBuildOptions, PlatformDefinition } from "../../../core/runtime/platform-definition.js";

const EXAMPLES = [
  "mikacli google calendar login --client-id google-client-id-example --client-secret google-client-secret-example",
  "mikacli google calendar auth-url --client-id google-client-id-example --redirect-uri http://127.0.0.1:3333/callback",
  "mikacli google calendar calendars --json",
  "mikacli google calendar events --calendar primary --limit 10 --json",
  "mikacli google calendar today --calendar primary --json",
  'mikacli google calendar create-event --calendar primary --summary "Launch review" --start 2026-04-12T10:00:00+05:30 --end 2026-04-12T10:30:00+05:30 --json',
  'mikacli google calendar update-event google-event-id-example --calendar primary --location "Zoom" --json',
] as const;

function buildCalendarCommand(_options: PlatformCommandBuildOptions = {}): Command {
  const command = new Command("calendar").description("Use Google Calendar through Google's OAuth2 APIs");

  command
    .command("auth-url")
    .description("Generate the Google OAuth consent URL for Calendar")
    .requiredOption("--client-id <id>", "Google OAuth client id")
    .requiredOption("--redirect-uri <uri>", "OAuth redirect URI")
    .option("--scopes <scopes>", "Comma- or space-separated scopes to request", parseGoogleScopes)
    .option("--state <value>", "Optional OAuth state value")
    .option("--login-hint <email>", "Optional Google account email hint")
    .action(async (input: { clientId: string; redirectUri: string; scopes?: string[]; state?: string; loginHint?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: calendarPlatformDefinition,
        actionId: "auth-url",
        spinnerText: "Generating Calendar OAuth consent URL...",
        successMessage: "Calendar OAuth consent URL generated.",
        action: () => calendarAdapter.authUrl(input),
      });
    });

  command
    .command("login")
    .description("Save a Calendar OAuth2 connection with localhost callback capture, an authorization code, or a refresh token")
    .option("--account <name>", "Optional saved connection name")
    .requiredOption("--client-id <id>", "Google OAuth client id")
    .requiredOption("--client-secret <secret>", "Google OAuth client secret")
    .option("--code <value>", "Authorization code returned from Google's consent flow")
    .option("--redirect-uri <uri>", "Optional localhost redirect URI to listen on during interactive login, or the URI used with --code")
    .option("--refresh-token <token>", "Existing Google refresh token")
    .option("--scopes <scopes>", "Comma- or space-separated scopes to request", parseGoogleScopes)
    .option("--timeout <seconds>", "Maximum seconds to wait for the localhost callback during interactive login", parseTimeoutSeconds, 300)
    .option("--login-hint <email>", "Optional Google account email hint for interactive login")
    .action(async (input: {
      account?: string;
      clientId: string;
      clientSecret: string;
      code?: string;
      redirectUri?: string;
      refreshToken?: string;
      scopes?: string[];
      timeout: number;
      loginHint?: string;
    }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: calendarPlatformDefinition,
        actionId: "login",
        spinnerText: "Saving Calendar OAuth connection...",
        successMessage: "Calendar OAuth connection saved.",
        action: () => calendarAdapter.login({
          account: input.account,
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          code: input.code,
          redirectUri: input.redirectUri,
          refreshToken: input.refreshToken,
          scopes: input.scopes,
          timeoutSeconds: input.timeout,
          loginHint: input.loginHint,
        }),
      });
    });

  command
    .command("status")
    .description("Check the saved Calendar OAuth connection")
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: calendarPlatformDefinition,
        actionId: "status",
        spinnerText: "Checking Calendar connection...",
        successMessage: "Calendar connection checked.",
        action: () => calendarAdapter.statusAction(input.account),
      });
    });

  command
    .command("me")
    .description("Show the current Google profile behind the Calendar connection")
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: calendarPlatformDefinition,
        actionId: "me",
        spinnerText: "Loading Calendar profile...",
        successMessage: "Calendar profile loaded.",
        action: () => calendarAdapter.me(input.account),
      });
    });

  command
    .command("calendars")
    .description("List visible Google calendars")
    .option("--account <name>", "Optional saved connection name")
    .option("--limit <number>", "Maximum calendars to return", parseOptionalLimit, 50)
    .action(async (input: { account?: string; limit: number }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: calendarPlatformDefinition,
        actionId: "calendars",
        spinnerText: "Loading calendars...",
        successMessage: "Calendars loaded.",
        action: () => calendarAdapter.calendars(input),
      });
    });

  command
    .command("calendar")
    .description("Load a single Google calendar")
    .argument("<calendar-id>", "Calendar id, for example primary")
    .option("--account <name>", "Optional saved connection name")
    .action(async (calendarId: string, input: { account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: calendarPlatformDefinition,
        actionId: "calendar",
        spinnerText: "Loading calendar...",
        successMessage: "Calendar loaded.",
        action: () => calendarAdapter.calendar({ account: input.account, calendarId }),
      });
    });

  command
    .command("events")
    .description("List Google Calendar events")
    .option("--calendar <id>", "Calendar id", "primary")
    .option("--query <query>", "Optional free-text event query")
    .option("--time-min <iso>", "Optional lower bound in RFC3339 or ISO-8601 format")
    .option("--time-max <iso>", "Optional upper bound in RFC3339 or ISO-8601 format")
    .option("--limit <number>", "Maximum events to return", parseOptionalLimit, 20)
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: {
      calendar: string;
      query?: string;
      timeMin?: string;
      timeMax?: string;
      limit: number;
      account?: string;
    }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: calendarPlatformDefinition,
        actionId: "events",
        spinnerText: "Loading calendar events...",
        successMessage: "Calendar events loaded.",
        action: () =>
          calendarAdapter.events({
            account: input.account,
            calendarId: input.calendar,
            query: input.query,
            timeMin: input.timeMin,
            timeMax: input.timeMax,
            limit: input.limit,
          }),
      });
    });

  command
    .command("today")
    .description("List today's Google Calendar events using the local machine timezone")
    .option("--calendar <id>", "Calendar id", "primary")
    .option("--limit <number>", "Maximum events to return", parseOptionalLimit, 20)
    .option("--account <name>", "Optional saved connection name")
    .action(async (input: { calendar: string; limit: number; account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: calendarPlatformDefinition,
        actionId: "today",
        spinnerText: "Loading today's calendar events...",
        successMessage: "Today's calendar events loaded.",
        action: () =>
          calendarAdapter.today({
            account: input.account,
            calendarId: input.calendar,
            limit: input.limit,
          }),
      });
    });

  command
    .command("event")
    .description("Load a single Google Calendar event")
    .argument("<event-id>", "Google Calendar event id")
    .option("--calendar <id>", "Calendar id", "primary")
    .option("--account <name>", "Optional saved connection name")
    .action(async (eventId: string, input: { calendar: string; account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: calendarPlatformDefinition,
        actionId: "event",
        spinnerText: "Loading calendar event...",
        successMessage: "Calendar event loaded.",
        action: () =>
          calendarAdapter.event({
            account: input.account,
            calendarId: input.calendar,
            eventId,
          }),
      });
    });

  command
    .command("create-event")
    .description("Create a Google Calendar event")
    .requiredOption("--summary <text>", "Event summary")
    .requiredOption("--start <value>", "Start time in ISO-8601 or YYYY-MM-DD format")
    .requiredOption("--end <value>", "End time in ISO-8601 or YYYY-MM-DD format")
    .option("--description <text>", "Optional event description")
    .option("--location <text>", "Optional event location")
    .option("--attendees <emails>", "Comma- or space-separated attendee emails", parseGoogleAttendees)
    .option("--time-zone <iana>", "Optional IANA timezone for dateTime inputs")
    .option("--calendar <id>", "Calendar id", "primary")
    .option("--account <name>", "Optional saved connection name")
    .action(async (
      input: {
        summary: string;
        start: string;
        end: string;
        description?: string;
        location?: string;
        attendees?: string[];
        timeZone?: string;
        calendar: string;
        account?: string;
      },
      cmd: Command,
    ) => {
      await runGoogleAction({
        cmd,
        definition: calendarPlatformDefinition,
        actionId: "create-event",
        spinnerText: "Creating calendar event...",
        successMessage: "Calendar event created.",
        action: () =>
          calendarAdapter.createEvent({
            account: input.account,
            calendarId: input.calendar,
            summary: input.summary,
            start: input.start,
            end: input.end,
            description: input.description,
            location: input.location,
            attendees: input.attendees,
            timeZone: input.timeZone,
          }),
      });
    });

  command
    .command("update-event")
    .description("Update a Google Calendar event")
    .argument("<event-id>", "Google Calendar event id")
    .option("--summary <text>", "Updated event summary")
    .option("--start <value>", "Updated start time in ISO-8601 or YYYY-MM-DD format")
    .option("--end <value>", "Updated end time in ISO-8601 or YYYY-MM-DD format")
    .option("--description <text>", "Updated event description")
    .option("--location <text>", "Updated event location")
    .option("--attendees <emails>", "Comma- or space-separated attendee emails", parseGoogleAttendees)
    .option("--time-zone <iana>", "Optional IANA timezone for dateTime inputs")
    .option("--status <value>", "Optional event status, for example confirmed or cancelled")
    .option("--calendar <id>", "Calendar id", "primary")
    .option("--account <name>", "Optional saved connection name")
    .action(async (
      eventId: string,
      input: {
        summary?: string;
        start?: string;
        end?: string;
        description?: string;
        location?: string;
        attendees?: string[];
        timeZone?: string;
        status?: string;
        calendar: string;
        account?: string;
      },
      cmd: Command,
    ) => {
      await runGoogleAction({
        cmd,
        definition: calendarPlatformDefinition,
        actionId: "update-event",
        spinnerText: "Updating calendar event...",
        successMessage: "Calendar event updated.",
        action: () =>
          calendarAdapter.updateEvent({
            account: input.account,
            calendarId: input.calendar,
            eventId,
            summary: input.summary,
            start: input.start,
            end: input.end,
            description: input.description,
            location: input.location,
            attendees: input.attendees,
            timeZone: input.timeZone,
            status: input.status,
          }),
      });
    });

  command
    .command("delete-event")
    .description("Delete a Google Calendar event")
    .argument("<event-id>", "Google Calendar event id")
    .option("--calendar <id>", "Calendar id", "primary")
    .option("--account <name>", "Optional saved connection name")
    .action(async (eventId: string, input: { calendar: string; account?: string }, cmd: Command) => {
      await runGoogleAction({
        cmd,
        definition: calendarPlatformDefinition,
        actionId: "delete-event",
        spinnerText: "Deleting calendar event...",
        successMessage: "Calendar event deleted.",
        action: () =>
          calendarAdapter.deleteEvent({
            account: input.account,
            calendarId: input.calendar,
            eventId,
          }),
      });
    });

  return command;
}

function parseGoogleAttendees(value: string): string[] {
  return value
    .split(/[\s,]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export const calendarPlatformDefinition: PlatformDefinition = {
  id: "calendar",
  category: "google",
  displayName: "Google Calendar",
  description: "List calendars, inspect events, and create, update, or delete Google Calendar events with OAuth2",
  authStrategies: ["oauth2"],
  buildCommand: buildCalendarCommand,
  adapter: calendarAdapter,
  examples: EXAMPLES,
};
