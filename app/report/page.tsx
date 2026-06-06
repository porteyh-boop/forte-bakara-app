import PageHeader from "@/components/PageHeader";
import ReportForm from "@/components/ReportForm";
import { REPORT_PAGE_SUBTITLE } from "@/lib/pilot-copy";

export default function ReportPage() {
  return (
    <div className="min-h-screen bg-gray-light">
      <PageHeader
        title="דיווח תקלה"
        subtitle={REPORT_PAGE_SUBTITLE}
        badge="דיווח חדש"
      />

      <main className="page-content -mt-2">
        <ReportForm />
      </main>
    </div>
  );
}
