import ChatThread from "@/components/ChatThread";

export default function FarmerChatPage({ params }: { params: { id: string } }) {
  return <ChatThread conversationId={params.id} viewerRole="farmer" />;
}
