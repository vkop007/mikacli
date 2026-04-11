import { AutoCliError } from "../../../errors.js";
import { GoogleApiClient } from "../shared/client.js";

export interface GoogleCalendarSummary {
  id?: string;
  summary?: string;
  description?: string;
  timeZone?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  webViewLink?: string;
}

export interface GoogleCalendarAttendee {
  email?: string;
  displayName?: string;
  organizer?: boolean;
  self?: boolean;
  optional?: boolean;
  responseStatus?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
  timeZone?: string;
  allDay?: boolean;
  created?: string;
  updated?: string;
  attendees?: GoogleCalendarAttendee[];
  attendeeCount?: number;
  organizerEmail?: string;
  creatorEmail?: string;
  conferenceLink?: string;
  webViewLink?: string;
}

type CalendarListResponse = {
  items?: CalendarListItem[];
};

type CalendarListItem = {
  id?: string;
  summary?: string;
  description?: string;
  timeZone?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
  backgroundColor?: string;
  foregroundColor?: string;
};

type CalendarApiEventDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type CalendarApiPerson = {
  email?: string;
  displayName?: string;
  self?: boolean;
};

type CalendarApiAttendee = CalendarApiPerson & {
  organizer?: boolean;
  optional?: boolean;
  responseStatus?: string;
};

type CalendarApiConferenceData = {
  entryPoints?: Array<{
    entryPointType?: string;
    uri?: string;
  }>;
};

type CalendarApiEvent = {
  id?: string;
  status?: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: CalendarApiEventDateTime;
  end?: CalendarApiEventDateTime;
  created?: string;
  updated?: string;
  attendees?: CalendarApiAttendee[];
  organizer?: CalendarApiPerson;
  creator?: CalendarApiPerson;
  hangoutLink?: string;
  conferenceData?: CalendarApiConferenceData;
};

export class CalendarApiClient {
  private readonly client: GoogleApiClient;

  constructor(accessToken: string, fetchImpl?: typeof fetch) {
    this.client = new GoogleApiClient({
      accessToken,
      baseUrl: "https://www.googleapis.com/calendar/v3",
      errorCode: "GOOGLE_CALENDAR_API_ERROR",
      fetchImpl,
    });
  }

  async listCalendars(input: { limit?: number } = {}): Promise<GoogleCalendarSummary[]> {
    const payload = await this.client.json<CalendarListResponse>("/users/me/calendarList", {}, {
      maxResults: input.limit ?? 50,
      minAccessRole: "reader",
    });
    return (payload.items ?? []).map((item) => summarizeCalendar(item));
  }

  async getCalendar(calendarId: string): Promise<GoogleCalendarSummary> {
    const payload = await this.client.json<CalendarListItem>(`/users/me/calendarList/${encodeURIComponent(calendarId)}`);
    return summarizeCalendar(payload);
  }

  async listEvents(input: {
    calendarId?: string;
    query?: string;
    limit?: number;
    timeMin?: string;
    timeMax?: string;
  }): Promise<GoogleCalendarEvent[]> {
    const payload = await this.client.json<{ items?: CalendarApiEvent[] }>(
      `/calendars/${encodeURIComponent(input.calendarId?.trim() || "primary")}/events`,
      {},
      {
        q: input.query?.trim() || undefined,
        maxResults: input.limit ?? 20,
        timeMin: input.timeMin?.trim() || undefined,
        timeMax: input.timeMax?.trim() || undefined,
        singleEvents: true,
        orderBy: input.timeMin?.trim() || input.timeMax?.trim() ? "startTime" : undefined,
      },
    );
    return (payload.items ?? []).map((item) => summarizeEvent(item));
  }

  async getEvent(input: { calendarId?: string; eventId: string }): Promise<GoogleCalendarEvent> {
    const payload = await this.client.json<CalendarApiEvent>(
      `/calendars/${encodeURIComponent(input.calendarId?.trim() || "primary")}/events/${encodeURIComponent(input.eventId)}`,
    );
    return summarizeEvent(payload);
  }

  async createEvent(input: {
    calendarId?: string;
    summary: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
    attendees?: string[];
    timeZone?: string;
  }): Promise<GoogleCalendarEvent> {
    const payload = await this.client.json<CalendarApiEvent>(
      `/calendars/${encodeURIComponent(input.calendarId?.trim() || "primary")}/events`,
      {
        method: "POST",
        body: buildEventBody({
          summary: input.summary,
          start: input.start,
          end: input.end,
          description: input.description,
          location: input.location,
          attendees: input.attendees,
          timeZone: input.timeZone,
        }),
      },
    );
    return summarizeEvent(payload);
  }

  async updateEvent(input: {
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
  }): Promise<GoogleCalendarEvent> {
    const body = buildEventBody({
      summary: input.summary,
      start: input.start,
      end: input.end,
      description: input.description,
      location: input.location,
      attendees: input.attendees,
      timeZone: input.timeZone,
      status: input.status,
    });
    if (Object.keys(body).length === 0) {
      throw new AutoCliError("GOOGLE_CALENDAR_UPDATE_EMPTY", "Calendar update requires at least one change.");
    }

    const payload = await this.client.json<CalendarApiEvent>(
      `/calendars/${encodeURIComponent(input.calendarId?.trim() || "primary")}/events/${encodeURIComponent(input.eventId)}`,
      {
        method: "PATCH",
        body,
      },
    );
    return summarizeEvent(payload);
  }

  async deleteEvent(input: { calendarId?: string; eventId: string }): Promise<void> {
    await this.client.request(
      `/calendars/${encodeURIComponent(input.calendarId?.trim() || "primary")}/events/${encodeURIComponent(input.eventId)}`,
      {
        method: "DELETE",
        headers: {
          accept: "*/*",
        },
      },
    );
  }
}

function summarizeCalendar(calendar: CalendarListItem): GoogleCalendarSummary {
  return {
    ...(calendar.id ? { id: calendar.id } : {}),
    ...(calendar.summary ? { summary: calendar.summary } : {}),
    ...(calendar.description ? { description: calendar.description } : {}),
    ...(calendar.timeZone ? { timeZone: calendar.timeZone } : {}),
    ...(typeof calendar.primary === "boolean" ? { primary: calendar.primary } : {}),
    ...(typeof calendar.selected === "boolean" ? { selected: calendar.selected } : {}),
    ...(calendar.accessRole ? { accessRole: calendar.accessRole } : {}),
    ...(calendar.backgroundColor ? { backgroundColor: calendar.backgroundColor } : {}),
    ...(calendar.foregroundColor ? { foregroundColor: calendar.foregroundColor } : {}),
    ...(calendar.id ? { webViewLink: buildCalendarUrl(calendar.id) } : {}),
  };
}

function summarizeEvent(event: CalendarApiEvent): GoogleCalendarEvent {
  const attendees = (event.attendees ?? []).map((attendee) => ({
    ...(attendee.email ? { email: attendee.email } : {}),
    ...(attendee.displayName ? { displayName: attendee.displayName } : {}),
    ...(typeof attendee.organizer === "boolean" ? { organizer: attendee.organizer } : {}),
    ...(typeof attendee.self === "boolean" ? { self: attendee.self } : {}),
    ...(typeof attendee.optional === "boolean" ? { optional: attendee.optional } : {}),
    ...(attendee.responseStatus ? { responseStatus: attendee.responseStatus } : {}),
  }));
  const start = summarizeDateTime(event.start);
  const end = summarizeDateTime(event.end);
  const conferenceLink = event.hangoutLink?.trim() || event.conferenceData?.entryPoints?.find((item) => item.uri?.trim())?.uri?.trim();

  return {
    id: event.id ?? "unknown",
    ...(event.status ? { status: event.status } : {}),
    ...(event.summary ? { summary: event.summary } : {}),
    ...(event.description ? { description: event.description } : {}),
    ...(event.location ? { location: event.location } : {}),
    ...(start.value ? { start: start.value } : {}),
    ...(end.value ? { end: end.value } : {}),
    ...(start.timeZone || end.timeZone ? { timeZone: start.timeZone ?? end.timeZone } : {}),
    ...(typeof start.allDay === "boolean" ? { allDay: start.allDay } : {}),
    ...(event.created ? { created: event.created } : {}),
    ...(event.updated ? { updated: event.updated } : {}),
    ...(attendees.length > 0 ? { attendees, attendeeCount: attendees.length } : {}),
    ...(event.organizer?.email ? { organizerEmail: event.organizer.email } : {}),
    ...(event.creator?.email ? { creatorEmail: event.creator.email } : {}),
    ...(conferenceLink ? { conferenceLink } : {}),
    ...(event.htmlLink ? { webViewLink: event.htmlLink } : {}),
  };
}

function summarizeDateTime(value: CalendarApiEventDateTime | undefined): {
  value?: string;
  timeZone?: string;
  allDay?: boolean;
} {
  if (!value) {
    return {};
  }

  if (value.date) {
    return {
      value: value.date,
      ...(value.timeZone ? { timeZone: value.timeZone } : {}),
      allDay: true,
    };
  }

  return {
    ...(value.dateTime ? { value: value.dateTime } : {}),
    ...(value.timeZone ? { timeZone: value.timeZone } : {}),
    allDay: false,
  };
}

function buildEventBody(input: {
  summary?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
  attendees?: string[];
  timeZone?: string;
  status?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (input.summary?.trim()) {
    body.summary = input.summary.trim();
  }

  if (input.description?.trim()) {
    body.description = input.description.trim();
  }

  if (input.location?.trim()) {
    body.location = input.location.trim();
  }

  if (input.start?.trim()) {
    body.start = buildDateTimeInput(input.start, input.timeZone);
  }

  if (input.end?.trim()) {
    body.end = buildDateTimeInput(input.end, input.timeZone);
  }

  if (input.attendees && input.attendees.length > 0) {
    body.attendees = input.attendees.map((email) => ({ email }));
  }

  if (input.status?.trim()) {
    body.status = input.status.trim();
  }

  return body;
}

function buildDateTimeInput(value: string, timeZone?: string): Record<string, string> {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) {
    return { date: trimmed };
  }

  return {
    dateTime: trimmed,
    ...(timeZone?.trim() ? { timeZone: timeZone.trim() } : {}),
  };
}

function buildCalendarUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calendarId)}`;
}
