"use client";

import { useRouter } from "next/navigation";

import { LoginFlow } from "@/components/auth/LoginFlow";
import { useSession } from "@/store/session";

export default function LoginPage() {
  const router = useRouter();
  const setUser = useSession((s) => s.setUser);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <LoginFlow
        onAuthenticated={(user) => {
          setUser(user);
          // replace, so Back does not return to the login form.
          router.replace("/");
        }}
      />
    </main>
  );
}
