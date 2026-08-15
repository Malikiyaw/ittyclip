"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, hydrateAuth } from "@/store/auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useAuth((s) => s.session);
  const hydrated = useAuth((s) => s.hydrated);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    hydrateAuth();
    setChecked(true);
  }, []);

  useEffect(() => {
    if (checked && hydrated && !session) router.replace("/auth");
  }, [checked, hydrated, session, router]);

  if (!checked || !hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <p className="font-mono text-xs tracking-widest text-white/60 uppercase">
          loading studio…
        </p>
      </div>
    );
  }

  if (!session) return null;

  return <>{children}</>;
}
