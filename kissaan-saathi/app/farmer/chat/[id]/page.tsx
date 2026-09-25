import ChatThread from "@/components/ChatThread";
import { requireUserId } from "@/lib/auth/session";

export default async function FarmerChatPage({ params }: { params: { id: string } }) {
  // middleware.ts already verified this user for this exact request — pass
  // it straight to ChatThread instead of it calling auth.getUser() again
  // client-side on mount.
  const userId = await requireUserId();
  return <ChatThread conversationId={params.id} viewerRole="farmer" userId={userId} />;
}
