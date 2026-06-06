import PageHeader from "@/components/PageHeader";
import ReportForm from "@/components/ReportForm";

export default function ReportPage() {
  return (
    <div className="min-h-screen bg-gray-light">
      <PageHeader
        title="דיווח תקלה"
        subtitle="מלאו את פרטי התקלה — הדיווח יועבר ישירות לחברת המעליות"
        badge="דיווח חדש"
      />

      <main className="page-content -mt-2">
        <ReportForm />
      </main>
    </div>
  );
}
