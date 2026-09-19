import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function HudSummaryRedirect() {
  redirect(OLD_TO_NEW["/hud/summary"]);
}
