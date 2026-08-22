import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function CouncilAgentsRedirect() {
  redirect(OLD_TO_NEW["/council/agents"]);
}
