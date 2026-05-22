import Link from "next/link";
import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck, Bell, Download, Boxes } from "lucide-react";

export default async function Home() {
  const user = await currentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="grid lg:grid-cols-2 gap-10 items-center py-10">
      <div>
        <div className="text-[12px] tracking-[0.3em] uppercase text-muted mb-3">
          Internal · v0.1
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
          One place for every <span className="brand-mark">infra</span> ask.
        </h1>
        <p className="mt-4 text-muted max-w-prose">
          Teams raise VM &amp; Kubernetes requirements with BoQ attachments and tenure.
          Infra reviews, exports and provisions. Automatic expiry alerts keep everyone
          honest — warnings, daily reminders, and a final shutdown notice.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/login" className="btn btn-primary">
            Sign in with Google <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Feature
          icon={<Boxes size={18} />}
          title="VMs &amp; Pods"
          body="Capture compute, storage, network and database requirements with a single form."
        />
        <Feature
          icon={<ShieldCheck size={18} />}
          title="Google Auth"
          body="Sign in with Google. Roles for raiser, manager, infra and admin."
        />
        <Feature
          icon={<Bell size={18} />}
          title="Smart alerts"
          body="T-7 warning, daily mails after expiry, and an automatic shutdown notice on day 7."
        />
        <Feature
          icon={<Download size={18} />}
          title="CSV export"
          body="Infra team can download new requirements as CSV in one click."
        />
      </div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card card-hover p-5">
      <div className="w-9 h-9 rounded-lg grid place-items-center bg-accent/15 text-accent mb-3">
        {icon}
      </div>
      <div className="font-semibold" dangerouslySetInnerHTML={{ __html: title }} />
      <div className="text-sm text-muted mt-1">{body}</div>
    </div>
  );
}
