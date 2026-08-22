import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function CouncilDecisionsRedirect() {
  redirect(OLD_TO_NEW["/council/decisions"]);
}
