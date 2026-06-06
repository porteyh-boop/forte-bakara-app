import HistoryList from "@/components/HistoryList";
import PageHeader from "@/components/PageHeader";
import { faults, getOpenFaults } from "@/lib/data";

export default function HistoryPage() {
  const openCount = getOpenFaults().length;

  return (
    <div className="min-h-screen bg-gray-light">
      <PageHeader
        title="היסטוריית תקלות"
        subtitle={`${faults.length} תקלות רשומות · ${openCount} פעילות`}
        badge="מגדל פורטה"
      />

      <main className="page-content -mt-2">
        <HistoryList faults={faults} />
      </main>
    </div>
  );
}
