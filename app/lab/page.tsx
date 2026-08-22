import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function LabRedirect() {
  redirect(OLD_TO_NEW["/lab"]);
}
