import RouteSkeleton from "@/components/RouteSkeleton";

// Shown by Next.js while any page inside /buyer is fetching its server
// data (e.g. right after a bottom-nav tap) — replaces what would otherwise
// be a blank white screen for the time the request takes. The
// buyer/layout.tsx header/nav shell stays visible throughout since only
// this inner slot suspends.
export default function BuyerLoading() {
  return <RouteSkeleton />;
}
