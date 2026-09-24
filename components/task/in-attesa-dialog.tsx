"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Chiede "in attesa di cosa" quando una task passa allo stato In attesa. */
export function InAttesaDialog({
  open,
  onOpenChange,
  valore,
  onConferma,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  valore: string;
  onConferma: (inAttesaDi: string) => void;
}) {
  const [testo, setTesto] = useState(valore);
  const [aperto, setAperto] = useState(open);
  // Ogni apertura riparte dal valore salvato.
  if (open !== aperto) {
    setAperto(open);
    if (open) setTesto(valore);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConferma(testo.trim());
            onOpenChange(false);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>In attesa di cosa?</DialogTitle>
            <DialogDescription>
              Per esempio «risposta del cliente» o «testi da Marco». Dopo 5 giorni la task compare in Oggi tra quelle
              da sollecitare.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder="In attesa di…"
            autoFocus
            maxLength={500}
            aria-label="In attesa di"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit">Salva</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
