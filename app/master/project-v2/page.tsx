import { Suspense } from "react";
import MasterProjectV2PageContent from "@/components/master-v2/project-v2/MasterProjectV2PageContent";

export default function MasterProjectV2Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center text-sm text-gray-text">
          טוען תיק פרויקט...
        </div>
      }
    >
      <MasterProjectV2PageContent />
    </Suspense>
  );
}
