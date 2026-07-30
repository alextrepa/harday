export interface OutlookConnectionSnapshot {
  configured: boolean;
  connected: boolean;
  accountEmail?: string;
  accountName?: string;
  lastError?: string;
}

export interface OutlookCalendarEvent {
  eventId: string;
  localDate: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  subject: string;
  organizer?: string;
  location?: string;
  isOnlineMeeting: boolean;
  webLink?: string;
}
