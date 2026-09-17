"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "hotel", label: "Hotel" },
  { value: "dhaba", label: "Dhaba" },
] as const;

export default function BuyerSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    contactName: "",
    phone: "",
    email: "",
    password: "",
    businessName: "",
    businessType: "restaurant",
    address: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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

      // See note in app/signup/farmer/page.tsx re: email confirmation settings.
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        role: "buyer",
        full_name: form.contactName,
        phone: form.phone,
        email: form.email,
      });

      if (profileError) {
        setError("Account created, but profile setup failed: " + profileError.message);
        setLoading(false);
        return;
      }

      const { error: buyerError } = await supabase.from("buyer_profiles").insert({
        user_id: data.user.id,
        business_name: form.businessName,
        business_type: form.businessType,
        address: form.address || null,
      });

      setLoading(false);

      if (buyerError) {
        setError("Profile created, but business details failed to save: " + buyerError.message);
        return;
      }

      router.push("/buyer/dashboard");
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
    <main className="min-h-screen px-6 py-12 max-w-md mx-auto">
      <h1 className="font-display text-3xl text-field mb-1">Join as a business buyer</h1>
      <p className="text-soil/70 mb-8">
        For restaurants, hotels and dhabas sourcing produce directly from
        nearby farmers.
      </p>

      {error && (
        <p className="mb-4 text-alert bg-alert/10 rounded-card px-4 py-3">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input required placeholder="Owner / contact person name" className="input-field" value={form.contactName} onChange={update("contactName")} />
        <input required type="tel" placeholder="Phone number" className="input-field" value={form.phone} onChange={update("phone")} />
        <input required type="email" placeholder="Email" className="input-field" value={form.email} onChange={update("email")} />
        <input required type="password" minLength={6} placeholder="Password (min 6 characters)" className="input-field" value={form.password} onChange={update("password")} />
        <input required placeholder="Business name" className="input-field" value={form.businessName} onChange={update("businessName")} />
        <select required className="input-field" value={form.businessType} onChange={update("businessType")}>
          {BUSINESS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input required placeholder="Business address" className="input-field" value={form.address} onChange={update("address")} />
        <button type="submit" disabled={loading} className="btn-primary mt-2">
          {loading ? "Creating account…" : "Create buyer account"}
        </button>
      </form>

      <p className="text-soil/70 text-sm mt-8">
        Already registered? <Link href="/login" className="text-field underline">Log in</Link>
      </p>
    </main>
  );
}
