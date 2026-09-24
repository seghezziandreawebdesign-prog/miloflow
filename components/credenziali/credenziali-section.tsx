"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog, useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { deleteCredenziale, saveCredenziale } from "@/lib/actions/credenziali";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { SbloccaDialog } from "./sblocca-dialog";
import { useVault } from "./vault-provider";

type Proprietario = { servizio_id: string } | { cliente_id: string };
type Credenziale = {
  id: string;
  etichetta: string;
  tipo: "link_password_manager" | "cifrata";
  url_password_manager: string | null;
  payload_cifrato: string | null;
  iv: string | null;
  salt: string | null;
};

function chiave(p: Proprietario) {
  return ["credenziali", "servizio_id" in p ? `s:${p.servizio_id}` : `c:${p.cliente_id}`];
}

async function carica(p: Proprietario): Promise<Credenziale[]> {
  const supabase = createClient();
  let q = supabase
    .from("credenziali")
    .select("id, etichetta, tipo, url_password_manager, payload_cifrato, iv, salt")
    .order("etichetta");
  q = "servizio_id" in p ? q.eq("servizio_id", p.servizio_id) : q.eq("cliente_id", p.cliente_id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function copiaTemporanea(testo: string) {
  await navigator.clipboard.writeText(testo);
  // Svuota gli appunti dopo 30 secondi, se contengono ancora la password.
  setTimeout(async () => {
    try {
      if ((await navigator.clipboard.readText()) === testo) await navigator.clipboard.writeText("");
    } catch {
      // Lettura degli appunti non consentita: si lascia com'è.
    }
  }, 30_000);
}

export function CredenzialiSection({ proprietario, username }: { proprietario: Proprietario; username?: string | null }) {
  const queryClient = useQueryClient();
  const vault = useVault();
  const { data: credenziali = [], isPending } = useQuery({ queryKey: chiave(proprietario), queryFn: () => carica(proprietario) });
  const [aggiungi, setAggiungi] = useState(false);
  const [sbloccaOpen, setSbloccaOpen] = useState(false);
  const [visibili, setVisibili] = useState<Record<string, string>>({});
  const conferma = useConfirm<Credenziale>();

  const sbloccata = vault.stato === "sbloccata";
  const aggiorna = () => queryClient.invalidateQueries({ queryKey: chiave(proprietario) });

  async function decifra(c: Credenziale) {
    if (!c.payload_cifrato || !c.iv || !c.salt) throw new Error("Credenziale incompleta");
    return vault.decifra({ payload_cifrato: c.payload_cifrato, iv: c.iv, salt: c.salt });
  }

  async function mostra(c: Credenziale) {
    if (visibili[c.id]) {
      setVisibili((v) => Object.fromEntries(Object.entries(v).filter(([k]) => k !== c.id)));
      return;
    }
    try {
      const testo = await decifra(c);
      setVisibili((v) => ({ ...v, [c.id]: testo }));
    } catch {
      toast.error("Impossibile decifrare: la credenziale è danneggiata o è stata cifrata con un'altra master password");
    }
  }

  async function copia(c: Credenziale) {
    try {
      await copiaTemporanea(await decifra(c));
      toast.success("Password copiata: gli appunti si svuotano tra 30 secondi");
    } catch {
      toast.error("Copia non riuscita");
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Credenziali</h3>
        <div className="flex items-center gap-1">
          {vault.stato !== "non_configurata" && vault.stato !== "caricamento" && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => (sbloccata ? vault.blocca() : setSbloccaOpen(true))}
              className={cn(sbloccata && "text-emerald-700")}
            >
              {sbloccata ? <LockOpen /> : <Lock />}
              {sbloccata ? "Sbloccata" : "Bloccata"}
            </Button>
          )}
          <Button variant="ghost" size="icon-xs" onClick={() => setAggiungi(true)} aria-label="Aggiungi credenziale">
            <Plus />
          </Button>
        </div>
      </div>

      {username && (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
          <span className="text-xs text-muted-foreground">Username</span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{username}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Copia username"
            onClick={async () => {
              await navigator.clipboard.writeText(username);
              toast.success("Username copiato");
            }}
          >
            <Copy />
          </Button>
        </div>
      )}

      {isPending ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : credenziali.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna credenziale.{" "}
          <button type="button" className="text-foreground underline underline-offset-4" onClick={() => setAggiungi(true)}>
            Aggiungine una
          </button>
        </p>
      ) : (
        <ul className="divide-y rounded-md ring-1 ring-foreground/10">
          {credenziali.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-2.5 py-2 text-sm">
              <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate">{c.etichetta}</p>
                {c.tipo === "cifrata" && (
                  <p className="truncate font-mono text-xs text-muted-foreground">{visibili[c.id] ?? "••••••••••"}</p>
                )}
              </div>
              {c.tipo === "link_password_manager" && c.url_password_manager ? (
                <a
                  href={c.url_password_manager}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Password manager <ExternalLink className="size-3" />
                </a>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={!sbloccata}
                    onClick={() => void mostra(c)}
                    aria-label={visibili[c.id] ? "Nascondi password" : "Mostra password"}
                    title={sbloccata ? undefined : "Sblocca la cassaforte"}
                  >
                    {visibili[c.id] ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={!sbloccata}
                    onClick={() => void copia(c)}
                    aria-label="Copia password"
                    title={sbloccata ? undefined : "Sblocca la cassaforte"}
                  >
                    <Copy />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon-xs" onClick={() => conferma.ask(c)} aria-label={`Elimina ${c.etichetta}`}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <NuovaCredenzialeDialog
        open={aggiungi}
        onOpenChange={setAggiungi}
        proprietario={proprietario}
        onRichiediSblocco={() => setSbloccaOpen(true)}
        onSaved={aggiorna}
      />
      <SbloccaDialog open={sbloccaOpen} onOpenChange={setSbloccaOpen} />
      <ConfirmDialog
        open={conferma.open}
        onOpenChange={conferma.onOpenChange}
        title={`Eliminare "${conferma.target?.etichetta ?? ""}"?`}
        description="La credenziale verrà cancellata definitivamente."
        onConfirm={async () => {
          if (!conferma.target) return;
          const result = await deleteCredenziale(conferma.target.id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Credenziale eliminata");
          await aggiorna();
        }}
      />
    </section>
  );
}

function NuovaCredenzialeDialog({
  open,
  onOpenChange,
  proprietario,
  onRichiediSblocco,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proprietario: Proprietario;
  onRichiediSblocco: () => void;
  onSaved: () => void;
}) {
  const vault = useVault();
  const [tipo, setTipo] = useState<"cifrata" | "link_password_manager">("cifrata");
  const [etichetta, setEtichetta] = useState("");
  const [valore, setValore] = useState("");
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function reset() {
    setEtichetta("");
    setValore("");
    setErrori({});
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrori({});
    try {
      const input =
        tipo === "cifrata"
          ? { tipo, etichetta, ...(await vault.cifra(valore)) }
          : { tipo, etichetta, url_password_manager: valore };
      const result = await saveCredenziale(proprietario, input);
      if (!result.ok) {
        setErrori(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Credenziale salvata");
      reset();
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Cifratura non riuscita");
    } finally {
      setPending(false);
    }
  }

  const serveSblocco = tipo === "cifrata" && vault.stato !== "sbloccata";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuova credenziale</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup className="gap-4">
            <div role="radiogroup" aria-label="Tipo di credenziale" className="inline-flex w-fit rounded-lg bg-muted p-0.5">
              {(
                [
                  ["cifrata", "Password cifrata"],
                  ["link_password_manager", "Link al password manager"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={tipo === v}
                  onClick={() => {
                    setTipo(v);
                    setValore("");
                  }}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm text-muted-foreground",
                    tipo === v && "bg-background font-medium text-foreground shadow-sm",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Field data-invalid={Boolean(errori.etichetta) || undefined}>
              <FieldLabel htmlFor="cred-etichetta">Etichetta</FieldLabel>
              <Input
                id="cred-etichetta"
                value={etichetta}
                onChange={(e) => setEtichetta(e.target.value)}
                placeholder="es. Pannello cPanel, FTP, Admin WordPress"
                autoFocus
              />
              <FieldError>{errori.etichetta}</FieldError>
            </Field>

            {vault.stato === "non_configurata" && tipo === "cifrata" ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                La cassaforte non è ancora configurata.{" "}
                <Link href="/impostazioni" className="underline underline-offset-4">
                  Imposta la master password
                </Link>{" "}
                oppure salva un link al password manager.
              </p>
            ) : serveSblocco ? (
              <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                Per cifrare una password serve la cassaforte sbloccata.{" "}
                <button type="button" className="underline underline-offset-4" onClick={onRichiediSblocco}>
                  Sblocca
                </button>
              </div>
            ) : (
              <Field data-invalid={Boolean(errori.url_password_manager) || undefined}>
                <FieldLabel htmlFor="cred-valore">{tipo === "cifrata" ? "Password" : "Link all'elemento"}</FieldLabel>
                <Input
                  id="cred-valore"
                  type={tipo === "cifrata" ? "password" : "url"}
                  value={valore}
                  onChange={(e) => setValore(e.target.value)}
                  placeholder={tipo === "cifrata" ? "" : "https://vault.bitwarden.com/#/…"}
                  autoComplete="new-password"
                />
                <FieldError>{errori.url_password_manager}</FieldError>
                {tipo === "cifrata" && (
                  <p className="text-xs text-muted-foreground">Viene cifrata in questo browser prima dell&apos;invio.</p>
                )}
              </Field>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Annulla
              </Button>
              <Button type="submit" disabled={pending || !etichetta.trim() || !valore || serveSblocco}>
                {pending && <Loader2 className="animate-spin" />}
                Salva
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
