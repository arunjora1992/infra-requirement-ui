import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid place-items-center py-24">
      <div className="card p-10 text-center">
        <div className="text-[11px] uppercase tracking-[0.3em] text-muted">404</div>
        <h1 className="text-2xl font-semibold mt-2">Not found</h1>
        <p className="text-muted mt-1">That page doesn’t exist.</p>
        <Link href="/dashboard" className="btn btn-primary mt-5">Back to dashboard</Link>
      </div>
    </div>
  );
}
