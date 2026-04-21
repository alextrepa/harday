import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from "@azure/msal-browser";

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

interface GraphDateTimeTimeZone {
  dateTime: string;
  timeZone?: string;
}

interface GraphCalendarEvent {
  id: string;
  subject?: string | null;
  isCancelled?: boolean;
  isAllDay?: boolean;
  showAs?: string | null;
  webLink?: string | null;
  start: GraphDateTimeTimeZone;
  end: GraphDateTimeTimeZone;
  organizer?: {
    emailAddress?: {
      name?: string | null;
      address?: string | null;
    } | null;
  } | null;
  location?: {
    displayName?: string | null;
  } | null;
  onlineMeeting?: object | null;
}

const graphScopes = ["Calendars.ReadBasic"] as const;

let clientPromise: Promise<PublicClientApplication> | undefined;

function getOutlookConfig() {
  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID?.trim();
  const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID?.trim() || "common";

  if (!clientId) {
    return null;
  }

  return {
    clientId,
    tenantId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
  };
}

function makeSnapshot(account: AccountInfo | null, lastError?: string): OutlookConnectionSnapshot {
  const configured = Boolean(getOutlookConfig());
  return {
    configured,
    connected: Boolean(account),
    accountEmail: account?.username,
    accountName: account?.name ?? undefined,
    lastError,
  };
}

async function getClient() {
  const config = getOutlookConfig();
  if (!config) {
    throw new Error("Set VITE_MICROSOFT_CLIENT_ID to enable Outlook meeting import.");
  }

  clientPromise ??= (async () => {
    const client = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: config.authority,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: "localStorage",
      },
    });

    await client.initialize();
    return client;
  })();

  return clientPromise;
}

async function getActiveAccount() {
  const client = await getClient();
  const active = client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null;
  if (active) {
    client.setActiveAccount(active);
  }
  return active;
}

function parseGraphDateTime(value: GraphDateTimeTimeZone) {
  const parsed = new Date(value.dateTime);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid Outlook date/time: ${value.dateTime}`);
  }
  return parsed;
}

export function outlookIntegrationEnabled() {
  return Boolean(getOutlookConfig());
}

export async function bootstrapOutlookAuth(): Promise<OutlookConnectionSnapshot> {
  if (!outlookIntegrationEnabled()) {
    return { configured: false, connected: false };
  }

  try {
    const client = await getClient();
    const redirectResult = await client.handleRedirectPromise();
    const account = redirectResult?.account ?? (await getActiveAccount());

    return makeSnapshot(account);
  } catch (error) {
    return makeSnapshot(null, error instanceof Error ? error.message : "Unable to restore Outlook sign-in.");
  }
}

export async function connectOutlook() {
  const client = await getClient();
  await client.loginRedirect({
    scopes: [...graphScopes],
    redirectStartPage: window.location.href,
  });
}

export async function disconnectOutlook() {
  if (!outlookIntegrationEnabled()) {
    return;
  }

  const client = await getClient();
  const account = await getActiveAccount();

  await client.logoutRedirect({
    account: account ?? undefined,
    postLogoutRedirectUri: window.location.origin,
  });
}

export async function syncOutlookMeetings(localDate: string): Promise<OutlookCalendarEvent[]> {
  const client = await getClient();
  const account = await getActiveAccount();
  if (!account) {
    throw new Error("Connect Outlook before syncing meetings.");
  }

  let accessToken: string;
  try {
    const token = await client.acquireTokenSilent({
      scopes: [...graphScopes],
      account,
    });
    accessToken = token.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await client.acquireTokenRedirect({
        scopes: [...graphScopes],
        account,
        redirectStartPage: window.location.href,
      });
    }
    throw error;
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const rangeStart = new Date(`${localDate}T00:00:00`);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + 1);

  const requestUrl = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  requestUrl.searchParams.set("startDateTime", rangeStart.toISOString());
  requestUrl.searchParams.set("endDateTime", rangeEnd.toISOString());
  requestUrl.searchParams.set(
    "$select",
    [
      "id",
      "subject",
      "start",
      "end",
      "showAs",
      "isCancelled",
      "isAllDay",
      "location",
      "organizer",
      "onlineMeeting",
      "webLink",
    ].join(","),
  );

  const response = await fetch(requestUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: `outlook.timezone="${timeZone}"`,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Microsoft Graph meeting sync failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as { value?: GraphCalendarEvent[] };
  return (payload.value ?? [])
    .filter((event) => !event.isCancelled && !event.isAllDay && event.showAs !== "free")
    .map((event) => {
      const startedAt = parseGraphDateTime(event.start).getTime();
      const endedAt = parseGraphDateTime(event.end).getTime();

      return {
        eventId: event.id,
        localDate,
        startedAt,
        endedAt,
        durationMs: Math.max(0, endedAt - startedAt),
        subject: event.subject?.trim() || "Untitled meeting",
        organizer: event.organizer?.emailAddress?.name || event.organizer?.emailAddress?.address || undefined,
        location: event.location?.displayName || undefined,
        isOnlineMeeting: Boolean(event.onlineMeeting),
        webLink: event.webLink || undefined,
      } satisfies OutlookCalendarEvent;
    })
    .filter((meeting) => meeting.durationMs > 0)
    .sort((left, right) => left.startedAt - right.startedAt);
}
