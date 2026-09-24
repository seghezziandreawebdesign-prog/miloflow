"use client";

import { ImageUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteCliente, setLogoCliente, setStatoCliente } from "@/lib/actions/clienti";
import { nomeCliente, STATI_CLIENTE } from "@/lib/clienti";
import type { SchedaCliente } from "@/lib/queries/clienti";
import { rowToClienteForm } from "@/lib/schemas/clienti";
import { createClient } from "@/lib/supabase/client";

import { ClienteDialog } from "../cliente-dialog";
import { ClienteLogo } from "../cliente-logo";
import { StatoClienteBadge } from "../stato-badge";

const TIPI_LOGO = ["image/png", "image/jpeg", "image/webp"];
const MAX_LOGO = 2 * 1024 * 1024;

export function IntestazioneCliente({
  cliente,
  tagSuggestions,
  isOwner,
}: {
  cliente: SchedaCliente["cliente"];
  tagSuggestions: string[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const nome = nomeCliente(cliente);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploading, startUpload] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function caricaLogo(file: File) {
    if (!TIPI_LOGO.includes(file.type)) {
      toast.error("Formato non supportato: usa PNG, JPG o WebP");
      return;
    }
    if (file.size > MAX_LOGO) {
      toast.error("Il logo supera i 2 MB");
      return;
    }
    startUpload(async () => {
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${cliente.id}/logo-${Date.now()}.${ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("loghi").upload(path, file, { contentType: file.type });
      if (error) {
        toast.error("Caricamento del logo non riuscito");
        return;
      }
      const result = await setLogoCliente(cliente.id, path);
      if (!result.ok) {
        await supabase.storage.from("loghi").remove([path]);
        toast.error(result.error);
        return;
      }
      toast.success("Logo aggiornato");
      router.refresh();
    });
  }

  function rimuoviLogo() {
    startUpload(async () => {
      const result = await setLogoCliente(cliente.id, null);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Logo rimosso");
        router.refresh();
      }
    });
  }

  async function cambiaStato(stato: string) {
    const result = await setStatoCliente(cliente.id, stato);
    if (!result.ok) toast.error(result.error);
    else toast.success(stato === "archiviato" ? "Cliente archiviato" : "Stato aggiornato");
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="group relative rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              aria-label="Logo del cliente"
              disabled={uploading}
            />
          }
        >
          <ClienteLogo nome={nome} colore={cliente.colore} logoUrl={cliente.logo_url} sito={cliente.sito} size="lg" />
          <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <ImageUp className="size-5" />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <DropdownMenuItem onClick={() => fileInput.current?.click()}>
            <ImageUp />
            {cliente.logo_path ? "Cambia logo" : "Carica logo"}
          </DropdownMenuItem>
          {cliente.logo_path && (
            <DropdownMenuItem variant="destructive" onClick={rimuoviLogo}>
              <Trash2 />
              Rimuovi logo
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInput}
        type="file"
        accept={TIPI_LOGO.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) caricaLogo(file);
          e.target.value = "";
        }}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{nome}</h1>
          <StatoClienteBadge stato={cliente.stato} />
        </div>
        {cliente.nome_breve && <p className="text-sm text-muted-foreground">{cliente.ragione_sociale}</p>}
        {cliente.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {cliente.tags.map((t) => (
              <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil />
          Modifica
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Altre azioni" />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Stato</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={cliente.stato} onValueChange={(v) => void cambiaStato(String(v))}>
                {STATI_CLIENTE.map((s) => (
                  <DropdownMenuRadioItem key={s.value} value={s.value}>
                    {s.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            {isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 />
                  Elimina cliente
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ClienteDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        clienteId={cliente.id}
        defaultValues={rowToClienteForm(cliente)}
        tagSuggestions={tagSuggestions}
        onSaved={() => router.refresh()}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Eliminare ${nome}?`}
        description="Verranno eliminati anche contatti, link, diario e credenziali del cliente. Se vuoi solo toglierlo dalla lista, archivialo."
        onConfirm={async () => {
          const result = await deleteCliente(cliente.id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Cliente eliminato");
          router.push("/clienti");
        }}
      />
    </div>
  );
}
