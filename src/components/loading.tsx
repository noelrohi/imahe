import { Loader2 } from "lucide-react";

export function Loading() {
  return (
    <div className="flex justify-center items-center h-[calc(100vh-64px)]">
      <Loader2 className="animate-spin" />
    </div>
  );
}
