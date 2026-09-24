"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteServizio } from "@/lib/actions/servizi";
import { cn } from "@/lib/utils";

export const AVVISO_ELIMINA_SERVIZIO =
  "Verranno eliminati anche credenziali e storico dei rinnovi; i movimenti già a budget restano, senza collegamento. Se non ti serve più, puoi disdirlo o archiviarlo.";

/** Cestino sulla riga di un servizio, con conferma. Su desktop compare passando col mouse. */
export function EliminaServizioButton({ servizio, className }: { servizio: { id: string; nome: string }; className?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        aria-label={`Elimina «${servizio.nome}»`}
        title="Elimina"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground/70 outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50",
          "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100",
          className,
        )}
      >
        <Trash2 className="size-4" />
      </button>
      <span className="contents" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {open && (
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title={`Eliminare «${servizio.nome}»?`}
            description={AVVISO_ELIMINA_SERVIZIO}
            onConfirm={async () => {
              const result = await deleteServizio(servizio.id);
              if (!result.ok) {
                toast.error(result.error);
                return false;
              }
              toast.success("Servizio eliminato");
              router.refresh();
            }}
          />
        )}
      </span>
    </>
  );
}
