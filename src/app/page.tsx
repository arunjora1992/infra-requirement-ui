import Link from "next/link";
import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck, Bell, Download, Boxes } from "lucide-react";
import { Logo } from "@/components/Logo";

export default async function Home() {
  const user = await currentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="grid lg:grid-cols-2 gap-12 items-center py-12">
      <div>
        <div className="flex items-center gap-3 mb-5">
          <Logo size={48} />
          <div className="text-[11px] tracking-[0.3em] uppercase text-muted">
            Internal · v0.1
          </div>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
          One place for every{" "}
          <span className="brand-mark">infra</span> ask.
        </h1>
        <p className="mt-5 text-muted max-w-prose text-[15px] leading-relaxed">
          Teams raise VM &amp; Kubernetes requirements with BoQ attachments and
          tenure. Infra reviews, provisions and exports. Automatic expiry alerts
          keep everyone honest — warnings, daily reminders, and a final shutdown
          notice.
        </p>
        <div className="mt-7 flex gap-3">
          <Link href="/login" className="btn btn-primary">
            Sign in with Google <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Feature
          icon={<Boxes size={18} />}
          title="VMs &amp; namespaces"
          body="Capture compute, storage, network and database details with one form, including K8s namespace quota."
        />
        <Feature
          icon={<ShieldCheck size={18} />}
          title="Google auth"
          body="Sign in with Google. Roles for raiser, manager, infra and admin — each sees only what they need."
        />
        <Feature
          icon={<Bell size={18} />}
          title="Smart alerts"
          body="T-7 warning, daily mails after expiry, and an automatic shutdown notice on day 7."
        />
        <Feature
          icon={<Download size={18} />}
          title="CSV &amp; PDF"
          body="Infra team can download every requirement as CSV or PDF in one click."
        />
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card card-hover p-5">
      <div className="w-9 h-9 rounded-lg grid place-items-center bg-accent/15 text-accent mb-3">
        {icon}
      </div>
      <div
        className="font-semibold"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <div className="text-sm text-muted mt-1 leading-relaxed">{body}</div>
    </div>
  );
}
