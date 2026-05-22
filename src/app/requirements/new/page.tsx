import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { NewRequirementForm } from "./NewRequirementForm";

export const dynamic = "force-dynamic";

export default async function NewRequirementPage() {
  const user = await currentUser();
  if (!user) redirect("/login?callbackUrl=/requirements/new");

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Raise an infra requirement</h1>
        <p className="text-muted text-sm">
          Describe what your project needs. The infra team will be notified by email.
        </p>
      </div>
      <NewRequirementForm defaultProject={user.team ?? ""} />
    </div>
  );
}
