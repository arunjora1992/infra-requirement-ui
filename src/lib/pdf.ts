import PDFDocument from "pdfkit";
import type { Requirement, VmSpec, User } from "@prisma/client";

type Full = Requirement & {
  raiser: User;
  vmSpecs: VmSpec[];
  _count?: { attachments: number };
};

const ACCENT = "#0EA5E9";
const MUTED = "#64748B";
const DARK = "#0F172A";
const BORDER = "#CBD5E1";

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

function header(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.fillColor(ACCENT).fontSize(10).font("Helvetica-Bold").text("INFRA REQUIREMENTS");
  doc.moveDown(0.2);
  doc.fillColor(DARK).fontSize(22).font("Helvetica-Bold").text(title);
  doc.fillColor(MUTED).fontSize(10).font("Helvetica").text(subtitle);
  doc.moveDown(0.5);
  doc
    .strokeColor(BORDER)
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.5);
}

function kv(doc: PDFKit.PDFDocument, k: string, v: string | number | null | undefined) {
  const left = doc.page.margins.left;
  const colW = (doc.page.width - left - doc.page.margins.right) / 2;
  const y = doc.y;
  doc.fillColor(MUTED).fontSize(9).font("Helvetica").text(k, left, y, { width: 110 });
  doc
    .fillColor(DARK)
    .fontSize(10)
    .font("Helvetica")
    .text(v === null || v === undefined || v === "" ? "—" : String(v), left + 115, y, {
      width: colW - 115,
    });
  doc.moveDown(0.2);
}

function sectionTitle(doc: PDFKit.PDFDocument, label: string) {
  doc.moveDown(0.5);
  doc.fillColor(ACCENT).fontSize(9).font("Helvetica-Bold").text(label.toUpperCase());
  doc
    .strokeColor(BORDER)
    .lineWidth(0.3)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.3);
}

function vmTable(doc: PDFKit.PDFDocument, vms: VmSpec[]) {
  if (vms.length === 0) {
    doc.fillColor(MUTED).fontSize(10).text("No VMs requested.");
    return;
  }
  const cols = [
    { k: "name", label: "Name", w: 75 },
    { k: "purpose", label: "Purpose", w: 95 },
    { k: "cpu", label: "vCPU", w: 35 },
    { k: "memoryGB", label: "RAM(GB)", w: 50 },
    { k: "storageGB", label: "Disk(GB)", w: 55 },
    { k: "osImage", label: "OS", w: 70 },
    { k: "hostname", label: "Hostname", w: 90 },
    { k: "ipAddress", label: "IP", w: 80 },
  ];
  const x0 = doc.page.margins.left;
  let y = doc.y;
  doc.fontSize(8).fillColor(MUTED).font("Helvetica-Bold");
  let x = x0;
  for (const c of cols) {
    doc.text(c.label, x, y, { width: c.w });
    x += c.w;
  }
  y += 12;
  doc
    .strokeColor(BORDER)
    .lineWidth(0.3)
    .moveTo(x0, y - 2)
    .lineTo(doc.page.width - doc.page.margins.right, y - 2)
    .stroke();
  doc.font("Helvetica").fillColor(DARK).fontSize(8);
  for (const v of vms) {
    if (y > doc.page.height - doc.page.margins.bottom - 30) {
      doc.addPage();
      y = doc.y;
    }
    x = x0;
    const row: Record<string, any> = {
      name: v.name,
      purpose: v.purpose ?? "—",
      cpu: v.cpu,
      memoryGB: v.memoryGB,
      storageGB: v.storageGB,
      osImage: v.osImage ?? "—",
      hostname: v.hostname ?? "—",
      ipAddress: v.ipAddress ?? "—",
    };
    let rowH = 0;
    for (const c of cols) {
      const h = doc.heightOfString(String(row[c.k]), { width: c.w - 4 });
      if (h > rowH) rowH = h;
    }
    for (const c of cols) {
      doc.text(String(row[c.k]), x, y, { width: c.w - 4 });
      x += c.w;
    }
    y += rowH + 4;
    doc.y = y;
  }
}

function renderOne(doc: PDFKit.PDFDocument, r: Full) {
  doc
    .fillColor(DARK)
    .fontSize(16)
    .font("Helvetica-Bold")
    .text(r.title);
  doc
    .fillColor(MUTED)
    .fontSize(9)
    .font("Helvetica")
    .text(
      `${r.projectName} · ${r.environment} · ${r.priority} · ${r.status} · raised by ${r.raiser.email} on ${fmtDate(r.raisedAt)}`,
    );

  sectionTitle(doc, "Description");
  doc.fillColor(DARK).fontSize(10).font("Helvetica").text(r.description || "—");

  sectionTitle(doc, "Justification");
  doc.fillColor(DARK).fontSize(10).font("Helvetica").text(r.justification || "—");

  sectionTitle(doc, "Lifecycle & ownership");
  kv(doc, "Start date", fmtDate(r.startDate));
  kv(doc, "Tenure", `${r.tenureDays} days`);
  kv(doc, "Expiry", fmtDate(r.expiryDate));
  kv(doc, "Manager", `${r.managerName} <${r.managerEmail}>`);
  kv(doc, "Cost center", r.costCenter);

  sectionTitle(doc, `Virtual machines (${r.vmSpecs.length})`);
  vmTable(doc, r.vmSpecs);

  sectionTitle(doc, "Kubernetes");
  kv(doc, "Required", r.needsK8s ? "yes" : "no");
  if (r.needsK8s) {
    kv(doc, "Namespace", r.k8sNamespace);
    kv(doc, "Quota CPU (cores)", r.nsQuotaCpu);
    kv(doc, "Quota memory (GB)", r.nsQuotaMemoryGB);
    kv(doc, "Quota storage (GB)", r.nsQuotaStorageGB);
    kv(doc, "Utility services", (r.utilityServices ?? []).join(", "));
  }

  sectionTitle(doc, "Network & storage");
  kv(doc, "Load balancer", r.needsLoadBalancer ? "yes" : "no");
  kv(doc, "Public IP", r.needsPublicIp ? "yes" : "no");
  kv(
    doc,
    "Managed DB",
    r.needsDatabase ? r.databaseEngine ?? "yes" : "no",
  );
  kv(doc, "Shared storage (GB)", r.storageGB);

  if (r.provisionedAt) {
    sectionTitle(doc, "Provisioning record");
    kv(doc, "Provisioned at", fmtDate(r.provisionedAt));
    kv(doc, "Namespace (actual)", r.provisionedNamespace);
    kv(doc, "Notes", r.provisioningNotes);
  }
}

export async function buildRequirementsPdf(items: Full[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    header(
      doc,
      "Infrastructure requirements",
      `${items.length} requirement(s) · generated ${new Date().toISOString()}`,
    );

    items.forEach((r, idx) => {
      if (idx > 0) doc.addPage();
      renderOne(doc, r);
    });

    doc.end();
  });
}
