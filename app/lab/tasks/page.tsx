import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function LabTasksRedirect() {
  redirect(OLD_TO_NEW["/lab/tasks"]);
}
