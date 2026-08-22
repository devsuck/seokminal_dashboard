import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function PortfolioOsPositionsRedirect() {
  redirect(OLD_TO_NEW["/portfolio-os/positions"]);
}
