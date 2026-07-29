import type { Metadata } from "next";
import { PrivacyNotice } from "@/components/privacy-notice";

export const metadata: Metadata = {
  title: "Privacidad — Clara",
  description: "Qué datos usa Clara, cuándo se graba tu voz y quién los procesa.",
};

// Plain-language privacy notice (audit P0: voice flowed to third-party
// processors with no disclosure anywhere). Every statement here describes
// verified behavior of the code as it exists — no invented retention or legal
// claims. Statements that need owner/counsel confirmation are tracked in the
// Phase 0 remediation report, not asserted here.
//
// Not legal advice and not a formal policy: this is the honest explanation a
// learner deserves, pending review by qualified counsel.

export default function PrivacyPage() {
  return <PrivacyNotice />;
}
