import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null = null;

function dryRun() {
  return (process.env.MAIL_DRY_RUN ?? "true").toLowerCase() === "true";
}

function transporter(): Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return cached;
}

export type SendMailInput = {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail(input: SendMailInput): Promise<{ ok: true; dryRun: boolean }> {
  const from = process.env.SMTP_FROM || "Infra Requirements <no-reply@example.com>";
  if (dryRun() || !process.env.SMTP_HOST) {
    console.log("[mailer:dry-run]", {
      from,
      to: input.to,
      cc: input.cc,
      subject: input.subject,
    });
    return { ok: true, dryRun: true };
  }
  await transporter().sendMail({
    from,
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    html: input.html,
    text: input.text ?? stripHtml(input.html),
  });
  return { ok: true, dryRun: false };
}

function stripHtml(html: string) {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
