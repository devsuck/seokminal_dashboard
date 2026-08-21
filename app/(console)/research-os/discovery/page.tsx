import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function Redirect() {
  redirect(OLD_TO_NEW["/research-os/discovery"]);
}
