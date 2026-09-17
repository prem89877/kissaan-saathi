import ChatThread from "@/components/ChatThread";

export default function BuyerChatPage({ params }: { params: { id: string } }) {
  return <ChatThread conversationId={params.id} viewerRole="buyer" />;
}
