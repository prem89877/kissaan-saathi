"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function FarmerSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    farmName: "",
    area: "",
    address: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
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

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

      if (signUpError || !data.user) {
        setError(signUpError?.message || "Could not create your account.");
        setLoading(false);
        return;
      }

      // NOTE (MVP): this insert relies on the signup having produced an active
      // session (i.e. "Confirm email" is OFF in Supabase Auth settings, or your
      // project auto-confirms). If you turn email confirmation ON, move this
      // profile-creation step to a callback route that runs after the user
      // verifies their email and is redirected back with a session.
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        role: "farmer",
        full_name: form.fullName,
        phone: form.phone,
        email: form.email,
      });

      if (profileError) {
        setError("Account created, but profile setup failed: " + profileError.message);
        setLoading(false);
        return;
      }

      const { error: farmerError } = await supabase.from("farmer_profiles").insert({
        user_id: data.user.id,
        farm_name: form.farmName || null,
        area: form.area || null,
        address: form.address || null,
      });

      setLoading(false);

      if (farmerError) {
        setError("Profile created, but farm details failed to save: " + farmerError.message);
        return;
      }

      router.push("/farmer/dashboard");
      router.refresh();
    } catch (err) {
      // Catches network/config failures (e.g. bad Supabase URL/key) that
      // supabase-js throws instead of returning as an { error } object —
      // without this, the button would otherwise spin forever with no message.
      setError(
        "Something went wrong reaching the server. Please check your connection and try again. " +
        (err instanceof Error ? `(${err.message})` : "")
      );
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-md mx-auto">
      <h1 className="font-display text-3xl text-field mb-1">Join as a farmer</h1>
      <p className="text-soil/70 mb-8">
        This doesn't replace how you already sell — it's an extra channel to
        reach nearby restaurants, hotels and dhabas.
      </p>

      {error && (
        <p className="mb-4 text-alert bg-alert/10 rounded-card px-4 py-3">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input required placeholder="Full name" className="input-field" value={form.fullName} onChange={update("fullName")} />
        <input required type="tel" placeholder="Phone number" className="input-field" value={form.phone} onChange={update("phone")} />
        <input required type="email" placeholder="Email" className="input-field" value={form.email} onChange={update("email")} />
        <input required type="password" minLength={6} placeholder="Password (min 6 characters)" className="input-field" value={form.password} onChange={update("password")} />
        <input placeholder="Farm / business name (optional)" className="input-field" value={form.farmName} onChange={update("farmName")} />
        <input placeholder="Area / village" className="input-field" value={form.area} onChange={update("area")} />
        <input placeholder="Full address" className="input-field" value={form.address} onChange={update("address")} />
        <button type="submit" disabled={loading} className="btn-primary mt-2">
          {loading ? "Creating account…" : "Create farmer account"}
        </button>
      </form>

      <p className="text-soil/70 text-sm mt-8">
        Already registered? <Link href="/login" className="text-field underline">Log in</Link>
      </p>
    </main>
  );
}
