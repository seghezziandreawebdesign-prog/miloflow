"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteProgetto } from "@/lib/actions/task";

import { invalidaTask } from "./dati";

/**
 * Conferma dell'eliminazione di un progetto (definitiva, sottoprogetti
 * compresi). Si sceglie cosa fare delle task: eliminarle con sottotask e
 * allegati, oppure tenerle senza progetto.
 */
export function EliminaProgettoDialog({
  open,
  onOpenChange,
  progettoId,
  nome,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progettoId: string;
  nome: string;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function elimina(conTask: boolean) {
    startTransition(async () => {
      const result = await deleteProgetto(progettoId, { conTask });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(conTask ? "Progetto eliminato con le sue task" : "Progetto eliminato: le task restano senza progetto");
      onOpenChange(false);
      invalidaTask(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["opzioni-task"] });
      router.refresh();
      onDeleted?.();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminare «{nome}»?</AlertDialogTitle>
          <AlertDialogDescription>
            L&apos;eliminazione è definitiva e comprende gli eventuali sottoprogetti. Scegli cosa fare delle task: eliminarle
            (con sottotask e allegati) oppure tenerle senza progetto.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annulla</AlertDialogCancel>
          <Button variant="outline" disabled={pending} onClick={() => elimina(false)}>
            {pending ? "Attendi…" : "Tieni le task"}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => elimina(true)}>
            {pending ? "Attendi…" : "Elimina anche le task"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
