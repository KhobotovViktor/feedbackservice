import { redirect } from "next/navigation";
import { createCityLinkToken } from "@/lib/auth-utils";

// Permanent entry point for embedding (stories etc.): the URL never expires —
// each visit mints a fresh city-selection token and lands on the regular
// survey page, which opens with the "pick your city" step. The chosen city's
// branch then drives the whole survey (questions, review links, thresholds).
export default async function CityLinkPage() {
  const token = await createCityLinkToken();
  redirect(`/survey/${token}`);
}
