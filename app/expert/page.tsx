import { redirect } from "next/navigation";
import ExpertPageContent from "@/components/ExpertPageContent";
import { isExpert } from "@/lib/roles";

export default function ExpertPage() {
  if (!isExpert()) {
    redirect("/");
  }

  return <ExpertPageContent />;
}
