import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const status = searchParams.status || "open";
  const supabase = createClient();

  const { data: disputes } = await supabase
    .from("disputes")
    .select("id, reason, status, created_at, order_id")
    .eq("status", status)
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-4">Disputes</h1>

      <div className="flex gap-2 mb-6">
        {["open", "under_review", "resolved", "rejected"].map((s) => (
          <Link
            key={s}
            href={`/admin/disputes?status=${s}`}
            className={`text-sm px-3 py-2 rounded-full whitespace-nowrap ${
              status === s ? "bg-field text-sand" : "bg-field/10 text-field"
            }`}
          >
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      {(!disputes || disputes.length === 0) && <p className="text-soil/70">Nothing here right now.</p>}

      <div className="flex flex-col gap-3">
        {disputes?.map((d) => (
          <Link key={d.id} href={`/admin/disputes/${d.id}`} className="card block">
            <p className="font-medium text-soil">{d.reason}</p>
            <p className="text-soil/60 text-sm mt-1">Order {d.order_id.slice(0, 8)}…</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
