import type { Metadata } from "next";
import { Suspense } from "react";

import { AmbitoBadge } from "@/components/ambito-badge";
import { PageHeader } from "@/components/page-header";
import { PulsanteNuovaTask } from "@/components/task/pulsante-nuova-task";
import { TaskView } from "@/components/task/task-view";
import { getFiltroAmbito } from "@/lib/ambito.server";

export const metadata: Metadata = { title: "Task" };

export default async function Page() {
  const filtroAmbito = await getFiltroAmbito();

  return (
    <>
      <PageHeader
        title="Task"
        description={
          <>
            Ambito: <AmbitoBadge ambito={filtroAmbito} className="align-middle" />
          </>
        }
        actions={<PulsanteNuovaTask />}
      />
      <Suspense>
        <TaskView filtroAmbito={filtroAmbito} />
      </Suspense>
    </>
  );
}
