"use client";

import { Archive, Ban, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { BarraSelezione, useSelezione } from "@/components/selezione";
import { Button } from "@/components/ui/button";
import { deleteServizi, setStatoServizi } from "@/lib/actions/servizi";

import { AVVISO_ELIMINA_SERVIZIO } from "./elimina-servizio";

const MESSAGGI = { attivo: "Riattivati", disdetto: "Disdetti", archiviato: "Archiviati" } as const;

/** Barra delle azioni sui servizi selezionati. Va messa dentro un SelezioneProvider. */
export function AzioniMultipleServizi() {
  const selezione = useSelezione();
  const router = useRouter();
  const [eliminaOpen, setEliminaOpen] = useState(false);
  if (!selezione) return null;
  const ids = [...selezione.selezionate];
  const n = ids.length;

  async function cambiaStato(stato: keyof typeof MESSAGGI) {
    const result = await setStatoServizi(ids, stato);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${MESSAGGI[stato]}: ${result.data.aggiornati === 1 ? "1 servizio" : `${result.data.aggiornati} servizi`}`);
    selezione!.setAttiva(false);
    router.refresh();
  }

  return (
    <>
      <BarraSelezione>
        <Button variant="ghost" size="sm" onClick={() => cambiaStato("disdetto")}>
          <Ban />
          <span className="max-sm:sr-only">Disdici</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => cambiaStato("archiviato")}>
          <Archive />
          <span className="max-sm:sr-only">Archivia</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => cambiaStato("attivo")}>
          <RotateCcw />
          <span className="max-sm:sr-only">Riattiva</span>
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setEliminaOpen(true)}>
          <Trash2 />
          <span className="max-sm:sr-only">Elimina</span>
        </Button>
      </BarraSelezione>
      <ConfirmDialog
        open={eliminaOpen}
        onOpenChange={setEliminaOpen}
        title={n === 1 ? "Eliminare il servizio selezionato?" : `Eliminare ${n} servizi?`}
        description={AVVISO_ELIMINA_SERVIZIO}
        onConfirm={async () => {
          const result = await deleteServizi(ids);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success(result.data.eliminati === 1 ? "Servizio eliminato" : `${result.data.eliminati} servizi eliminati`);
          selezione.setAttiva(false);
          router.refresh();
        }}
      />
    </>
  );
}
