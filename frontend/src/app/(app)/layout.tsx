"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { useSession } from "@/store/session";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser } = useSession();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // The cookie survives reloads but the store does not, so rehydrate the
    // session from the server on mount.
    if (user) {
      setChecked(true);
      return;
    }
    api
      .get<User>("/api/users/me")
      .then(setUser)
      .catch(() => router.replace("/login"))
      .finally(() => setChecked(true));
  }, [user, setUser, router]);

  if (!checked) {
    return <div className="min-h-screen bg-surface" aria-busy="true" />;
  }

  return <div className="min-h-screen bg-surface">{children}</div>;
}
