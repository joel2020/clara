import { Suspense } from "react";
import { Splash } from "@/components/splash";
import { VirtualCallScreen } from "@/components/virtual-call/virtual-call-screen";

// The Virtual Call route.
//
// VirtualCallScreen reads ?scenario= through useSearchParams, which suspends
// during a production prerender. Without this boundary the build fails with
// "Missing Suspense boundary with useSearchParams" (see
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md),
// so the boundary is the route's job, not the component's.

export default function VirtualCallPage() {
  return (
    <Suspense fallback={<Splash />}>
      <VirtualCallScreen />
    </Suspense>
  );
}
