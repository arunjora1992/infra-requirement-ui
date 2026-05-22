import type { Requirement } from "@prisma/client";

const baseStyle = `
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: #0b1020; color: #e6ecff; padding: 24px;
`;

function shell(title: string, accent: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#0b1020">
  <div style="${baseStyle}">
    <div style="max-width:640px;margin:0 auto;background:linear-gradient(180deg,#0f1530,#0b1020);
                border:1px solid ${accent}40;border-radius:14px;padding:28px;
                box-shadow:0 0 40px ${accent}30">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        <div style="width:10px;height:10px;border-radius:999px;background:${accent};box-shadow:0 0 12px ${accent}"></div>
        <div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:${accent}">Infra Requirements</div>
      </div>
      <h1 style="font-size:22px;margin:0 0 12px 0;color:#fff">${title}</h1>
      ${body}
      <hr style="border:none;border-top:1px solid #ffffff14;margin:24px 0" />
      <div style="font-size:12px;color:#8b95b8">Automated message — do not reply.</div>
    </div>
  </div></body></html>`;
}

function fmtDate(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

function detailsTable(r: Requirement) {
  const row = (k: string, v: string | number | null | undefined) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#8b95b8">${k}</td><td style="padding:6px 0;color:#e6ecff">${v ?? "—"}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;margin:8px 0 16px 0">
    ${row("Title", r.title)}
    ${row("Team", r.team)}
    ${row("Environment", r.environment)}
    ${row("Priority", r.priority)}
    ${row("VM count", r.vmCount)}
    ${row("Pod count", r.podCount)}
    ${row("Raised", fmtDate(r.raisedAt))}
    ${row("Expiry", fmtDate(r.expiryDate))}
    ${row("Manager", `${r.managerName} (${r.managerEmail})`)}
  </table>`;
}

export function preExpiryEmail(r: Requirement, daysLeft: number) {
  const accent = "#f59e0b";
  return {
    subject: `[Infra] Expiry in ${daysLeft} day(s) — ${r.title}`,
    html: shell(
      `⚠ Requirement expires in ${daysLeft} day(s)`,
      accent,
      `<p style="color:#cbd2e5">
         The infrastructure requirement <strong>${r.title}</strong> for team <strong>${r.team}</strong>
         is scheduled to expire on <strong>${fmtDate(r.expiryDate)}</strong>.
         If it is still needed, request an extension before this date.
       </p>
       ${detailsTable(r)}`
    ),
  };
}

export function postExpiryEmail(r: Requirement, daysSince: number) {
  const accent = "#ef4444";
  return {
    subject: `[Infra] EXPIRED ${daysSince} day(s) ago — ${r.title}`,
    html: shell(
      `Requirement expired ${daysSince} day(s) ago`,
      accent,
      `<p style="color:#cbd2e5">
         <strong>${r.title}</strong> expired on <strong>${fmtDate(r.expiryDate)}</strong>.
         If an extension is not raised, resources will be <strong>shut down on day 7</strong> after expiry.
       </p>
       ${detailsTable(r)}`
    ),
  };
}

export function shutdownEmail(r: Requirement) {
  const accent = "#dc2626";
  return {
    subject: `[Infra] SHUTDOWN scheduled — ${r.title}`,
    html: shell(
      `Shutdown initiated`,
      accent,
      `<p style="color:#cbd2e5">
         The grace period has ended. Infrastructure for <strong>${r.title}</strong>
         (team <strong>${r.team}</strong>) is scheduled for shutdown.
         Contact the Infra team immediately if this is incorrect.
       </p>
       ${detailsTable(r)}`
    ),
  };
}

export function newRequirementEmail(r: Requirement) {
  const accent = "#22d3ee";
  return {
    subject: `[Infra] New requirement raised — ${r.title}`,
    html: shell(
      `New requirement submitted`,
      accent,
      `<p style="color:#cbd2e5">
         A new infrastructure requirement has been raised and is awaiting review.
       </p>
       ${detailsTable(r)}`
    ),
  };
}
