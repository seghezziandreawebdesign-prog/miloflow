import type { Metadata } from "next";
import { Suspense } from "react";

import { TaskView } from "@/components/task/task-view";
import { getFiltroAmbito } from "@/lib/ambito.server";

export const metadata: Metadata = { title: "Task" };

export default async function Page() {
  const filtroAmbito = await getFiltroAmbito();

  return (
    <Suspense>
      <TaskView filtroAmbito={filtroAmbito} />
    </Suspense>
  );
}
