"use client";

import { Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MasterPasswordErrata } from "@/lib/crypto/vault";

import { useVault } from "./vault-provider";

export function SbloccaDialog({
  open,
  onOpenChange,
  onSbloccata,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSbloccata?: () => void;
}) {
  const { sblocca } = useVault();
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrore(null);
    try {
      await sblocca(password);
      setPassword("");
      onOpenChange(false);
      onSbloccata?.();
    } catch (err) {
      setErrore(err instanceof MasterPasswordErrata ? "Master password errata" : "Sblocco non riuscito");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setPassword("");
          setErrore(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyhole className="size-4" />
            Sblocca la cassaforte
          </DialogTitle>
          <DialogDescription>
            La master password resta in questo browser: serve a decifrare le password e non viene mai inviata al server.
            La cassaforte si richiude dopo 15 minuti di inattività.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Master password"
            aria-label="Master password"
            aria-invalid={Boolean(errore) || undefined}
            autoComplete="off"
            autoFocus
          />
          {errore && (
            <p role="alert" className="text-sm text-destructive">
              {errore}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !password}>
              {pending && <Loader2 className="animate-spin" />}
              {pending ? "Verifica…" : "Sblocca"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
