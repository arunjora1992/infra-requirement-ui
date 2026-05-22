"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const { status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";

  useEffect(() => {
    if (status === "authenticated") router.replace(callbackUrl);
  }, [status, router, callbackUrl]);

  return <LoginShell onSignIn={() => signIn("google", { callbackUrl })} />;
}

function LoginShell({ onSignIn }: { onSignIn?: () => void }) {
  return (
    <div className="grid place-items-center py-20">
      <div className="card p-8 w-full max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-accent-gradient grid place-items-center shadow-glow mb-4">
          <LogIn className="text-white" />
        </div>
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-muted mt-1">Sign in with your Google account to continue.</p>
        <button
          className="btn btn-primary w-full mt-6 justify-center"
          onClick={onSignIn}
          disabled={!onSignIn}
        >
          Continue with Google
        </button>
        <div className="text-[11px] text-muted mt-4">
          Access is restricted to allowed domains.
        </div>
      </div>
    </div>
  );
}
