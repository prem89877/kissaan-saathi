import { createClient } from "@/lib/supabase/server";

export default async function TermsPage() {
  const supabase = createClient();
  const { data: terms } = await supabase
    .from("terms_and_conditions")
    .select("body, version")
    .eq("is_active", true)
    .single();

  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl text-field mb-1">Terms &amp; Conditions</h1>
      <p className="text-soil/50 text-sm mb-6">Version {terms?.version ?? "—"}</p>
      <p className="text-soil/90 whitespace-pre-line">{terms?.body ?? "Terms are being finalized."}</p>
    </main>
  );
}
