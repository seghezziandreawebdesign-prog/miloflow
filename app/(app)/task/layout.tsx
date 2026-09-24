import { Suspense } from "react";

import { TaskSidebar } from "@/components/task/task-sidebar";
import { getFiltroAmbito } from "@/lib/ambito.server";

/**
 * Pagina Task: a sinistra viste e progetti (su mobile un selettore), a
 * destra il contenuto. Il layout resta montato navigando tra le viste e i
 * progetti, quindi la colonna non si ricarica.
 */
export default async function TaskLayout({ children }: LayoutProps<"/task">) {
  const filtroAmbito = await getFiltroAmbito();

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-8">
      <Suspense>
        <TaskSidebar filtroAmbito={filtroAmbito} />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
