"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteTask } from "@/lib/actions/task";
import { cn } from "@/lib/utils";

import { invalidaTask } from "./dati";

type TaskDaEliminare = { id: string; titolo: string; parent_id: string | null; sottotask_totali: number };

/**
 * Cestino sulla riga di una task, con conferma. Su desktop compare passando
 * col mouse; sugli schermi touch è sempre visibile.
 */
export function EliminaTaskButton({ task, className }: { task: TaskDaEliminare; className?: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const sottotask = task.parent_id ? 0 : task.sottotask_totali;

  return (
    <>
      <button
        type="button"
        aria-label={`Elimina «${task.titolo}»`}
        title="Elimina"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "-my-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground/70 outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50",
          "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100",
          className,
        )}
      >
        <Trash2 className="size-4" />
      </button>
      {/* Il dialog è in un portale, ma gli eventi React risalgono alla riga: qui si fermano. */}
      <span className="contents" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {open && (
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title={`Eliminare «${task.titolo}»?`}
            description={
              sottotask > 0
                ? `Verranno eliminate anche ${sottotask === 1 ? "la sottotask" : `le ${sottotask} sottotask`}. L'operazione non si può annullare.`
                : "L'operazione non si può annullare."
            }
            onConfirm={async () => {
              const result = await deleteTask(task.id);
              if (!result.ok) {
                toast.error(result.error);
                return false;
              }
              toast.success("Task eliminata");
              invalidaTask(queryClient);
              router.refresh();
            }}
          />
        )}
      </span>
    </>
  );
}
