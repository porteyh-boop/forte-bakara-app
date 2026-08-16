import { Suspense } from "react";
import MasterProjectV2PageKeyed from "@/app/master/project-v2/MasterProjectV2PageKeyed";

export default function MasterProjectV2Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center text-sm text-gray-text">
          טוען תיק פרויקט...
        </div>
      }
    >
      <MasterProjectV2PageKeyed />
    </Suspense>
  );
}
