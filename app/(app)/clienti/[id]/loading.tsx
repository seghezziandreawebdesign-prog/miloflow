import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="h-7 w-56" />
      </div>
      <Skeleton className="h-9 w-80 rounded-full" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
