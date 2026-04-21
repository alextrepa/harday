import { useLocalState } from "@/lib/local-hooks";

export function SettingsDebugPage() {
  const state = useLocalState();

  return (
    <div className="settings-sections">
      {/* ── Local Storage Status ──────────────────────────────────── */}
      <section className="settings-section">
        <h2 className="settings-section-title">Local Storage Status</h2>

        <div className="space-y-1 text-sm text-foreground/70">
          <p>{state.outlookMeetingDrafts.length} imported Outlook meetings</p>
          <p>{state.timesheetEntries.length} committed timesheet entries</p>
          <p>{state.rules.length} explicit local rules</p>
        </div>

        <div className="message-panel">
          Sync should stay limited to committed timesheets, project metadata, and any explicitly accepted rules if shared storage returns later.
        </div>
      </section>
    </div>
  );
}
