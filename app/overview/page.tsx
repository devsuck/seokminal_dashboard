import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function OverviewRedirect() {
  redirect(OLD_TO_NEW["/overview"]);
}
