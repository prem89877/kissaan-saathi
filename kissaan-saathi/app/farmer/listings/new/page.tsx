import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import AddListingForm from "@/components/AddListingForm";

export default async function NewListingPage() {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request.
  const userId = await requireUserId();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .order("name");

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-1">Add a new listing</h1>
      <p className="text-soil/70 mb-6">
        Fill in the details below. Your listing goes to an admin for review
        before it's visible to buyers.
      </p>
      <AddListingForm categories={categories ?? []} userId={userId} />
    </div>
  );
}
