"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import LanguageToggle from "@/components/LanguageToggle";

export default function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}

function LoginFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const suspended = params.get("suspended") === "1";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        setError("App isn't configured correctly (missing Supabase URL/key). Please contact support.");
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Email or password is incorrect. Please try again.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      setLoading(false);

      if (!profile) {
        setError("We couldn't find a profile for this account. Please contact support.");
        return;
      }

      router.push(params.get("next") || `/${profile.role}/dashboard`);
      router.refresh();
    } catch (err) {
      setError(
        "Something went wrong reaching the server. Please check your connection and try again. " +
        (err instanceof Error ? `(${err.message})` : "")
      );
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-12 flex flex-col justify-center max-w-md mx-auto">
      <div className="flex justify-end mb-4">
        <LanguageToggle className="flex items-center gap-1 text-sm text-field" />
      </div>
      <h1 className="font-display text-3xl text-field mb-1">{t("auth.welcomeBack")}</h1>
      <p className="text-soil/70 mb-8">{t("auth.logInSubtitle")}</p>

      {suspended && (
        <p className="mb-4 text-alert bg-alert/10 rounded-card px-4 py-3">
          Your account has been suspended. Contact support for details.
        </p>
      )}
      {error && (
        <p className="mb-4 text-alert bg-alert/10 rounded-card px-4 py-3">{error}</p>
      )}

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder={t("auth.email")}
          className="input-field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          placeholder={t("auth.password")}
          className="input-field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? t("common.loading") : t("common.logIn")}
        </button>
      </form>

      <p className="text-soil/70 text-sm mt-8">
        {t("auth.newHere")}{" "}
        <Link href="/signup/farmer" className="text-field underline">{t("landing.joinFarmer")}</Link>
        {" or "}
        <Link href="/signup/buyer" className="text-field underline">{t("landing.joinBuyer")}</Link>
      </p>
    </main>
  );
}
