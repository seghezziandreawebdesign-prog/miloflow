"use client";

import { CalendarRange, List, Plus, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useApriEntita } from "@/components/drawer/use-apri-entita";
import { EmptyState } from "@/components/empty-state";
import { BarraFiltri, CampoRicerca } from "@/components/filtri/barra-filtri";
import { FiltroChip } from "@/components/filtri/filtro-chip";
import { Segmented } from "@/components/segmented";
import { attributiSelezione, CasellaSelezione, PulsanteSeleziona, SelezioneProvider, useSelezione } from "@/components/selezione";
import { TipoIcona } from "@/components/tipo-icona";
import { Button } from "@/components/ui/button";
import { ambitoDiDefault, type FiltroAmbito } from "@/lib/ambito";
import { capitalize, formatCurrency, formatDate, todayISO } from "@/lib/dates/format";
import { etichettaMetodo } from "@/lib/metodi-pagamento";
import type { ServizioLista } from "@/lib/queries/servizi";
import { servizioVuoto } from "@/lib/schemas/servizi";
import { frequenza, scadenzeNelPeriodo, type StatoScadenza } from "@/lib/servizi";
import { useLocalPreference } from "@/lib/use-local-preference";
import { cn } from "@/lib/utils";

import { AzioniMultipleServizi } from "./azioni-multiple";
import { ClientiLoghi } from "./clienti-loghi";
import { EliminaServizioButton } from "./elimina-servizio";
import { ServizioDialog } from "./servizio-dialog";
import { StatoScadenzaBadge } from "./stato-scadenza-badge";

type FiltroScadenza = "tutti" | "scaduti" | "7" | "30" | "senza";
type Vista = "lista" | "mese";

const FILTRI_STATO = [
  { value: "attivo", label: "Attivi" },
  { value: "disdetto", label: "Disdetti" },
  { value: "archiviato", label: "Archiviati" },
  { value: "tutti", label: "Tutti" },
];
const FILTRI_CHI_PAGA = [
  { value: "tutti", label: "Chiunque" },
  { value: "io", label: "Pago io" },
  { value: "cliente", label: "Paga il cliente" },
];

export function ServiziView({
  servizi,
  filtroAmbito,
  mostraCosti,
}: {
  servizi: ServizioLista[];
  filtroAmbito: FiltroAmbito;
  mostraCosti: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const apri = useApriEntita();

  const [query, setQuery] = useState("");
  const [scadenza, setScadenza] = useState<FiltroScadenza>("tutti");
  const [stato, setStato] = useState("attivo");
  const [tipo, setTipo] = useState("tutti");
  const [cliente, setCliente] = useState("tutti");
  const [chiPaga, setChiPaga] = useState("tutti");
  const [vista, setVista] = useLocalPreference<Vista>("servizi.vista", ["lista", "mese"], "lista");
  const creaAperto = searchParams.get("nuovo") === "1";
  // Dal calendario: ?nuovo=1&scadenza=yyyy-MM-dd precompila la prossima scadenza.
  const scadenzaIniziale = searchParams.get("scadenza") ?? "";

  function setCreaAperto(open: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (open) params.set("nuovo", "1");
    else {
      params.delete("nuovo");
      params.delete("scadenza");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const attivi = servizi.filter((s) => s.stato === "attivo");
  // giorni_alla_scadenza è null per gli accessi (servizi senza scadenza).
  const conteggi = {
    scaduti: attivi.filter((s) => s.giorni_alla_scadenza !== null && s.giorni_alla_scadenza < 0).length,
    "7": attivi.filter((s) => s.giorni_alla_scadenza !== null && s.giorni_alla_scadenza >= 0 && s.giorni_alla_scadenza <= 7).length,
    "30": attivi.filter((s) => s.giorni_alla_scadenza !== null && s.giorni_alla_scadenza >= 0 && s.giorni_alla_scadenza <= 30).length,
    senza: attivi.filter((s) => s.giorni_alla_scadenza === null).length,
  };

  const tipi = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of servizi) if (s.tipo_id && s.tipo_nome) m.set(s.tipo_id, s.tipo_nome);
    return [...m].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "it"));
  }, [servizi]);
  const clienti = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of servizi) for (const c of s.clienti) m.set(c.id, c.nome);
    return [...m].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "it"));
  }, [servizi]);

  const filtrati = useMemo(() => {
    const q = query.trim().toLowerCase();
    return servizi.filter((s) => {
      const giorni = s.giorni_alla_scadenza;
      // I contatori guardano solo i servizi attivi.
      if (scadenza !== "tutti" && s.stato !== "attivo") return false;
      if (scadenza === "scaduti" && (giorni === null || giorni >= 0)) return false;
      if (scadenza === "7" && (giorni === null || giorni < 0 || giorni > 7)) return false;
      if (scadenza === "30" && (giorni === null || giorni < 0 || giorni > 30)) return false;
      if (scadenza === "senza" && giorni !== null) return false;
      if (scadenza === "tutti" && stato !== "tutti" && s.stato !== stato) return false;
      if (tipo !== "tutti" && s.tipo_id !== tipo) return false;
      if (cliente !== "tutti" && !s.clienti.some((c) => c.id === cliente)) return false;
      if (chiPaga !== "tutti" && s.chi_paga !== chiPaga) return false;
      if (q && ![s.nome, s.fornitore, ...s.clienti.map((c) => c.nome)].some((v) => v?.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [servizi, query, scadenza, stato, tipo, cliente, chiPaga]);

  const filtriAttivi = stato !== "attivo" || tipo !== "tutti" || cliente !== "tutti" || chiPaga !== "tutti" || query !== "";

  const dialog = (
    <ServizioDialog
      open={creaAperto}
      onOpenChange={setCreaAperto}
      defaultValues={servizioVuoto(ambitoDiDefault(filtroAmbito), scadenzaIniziale)}
      onSaved={(id) => apri({ tipo: "servizio", id })}
    />
  );

  if (servizi.length === 0) {
    return (
      <>
        <EmptyState
          icon={RefreshCw}
          title="Nessun servizio"
          description="Domini, hosting, licenze, abbonamenti, ma anche accessi e account senza scadenza."
          action={
            <Button onClick={() => setCreaAperto(true)}>
              <Plus />
              Aggiungi il primo servizio
            </Button>
          }
        />
        {dialog}
      </>
    );
  }

  return (
    <SelezioneProvider key={vista} className="space-y-5">
      <Segmented
        label=""
        size="lg"
        value={scadenza}
        onChange={setScadenza}
        opzioni={[
          { value: "tutti", label: "Attivi", conteggio: attivi.length },
          { value: "scaduti", label: "Scaduti", conteggio: conteggi.scaduti, tono: "text-red-600" },
          { value: "7", label: "Entro 7 giorni", conteggio: conteggi["7"], tono: "text-orange-600" },
          { value: "30", label: "Entro 30 giorni", conteggio: conteggi["30"], tono: "text-yellow-700" },
          ...(conteggi.senza > 0 ? [{ value: "senza" as const, label: "Accessi", conteggio: conteggi.senza }] : []),
        ]}
        className="max-w-3xl"
      />

      <BarraFiltri
        ricerca={
          <CampoRicerca value={query} onChange={setQuery} placeholder="Cerca per nome, fornitore, cliente…" label="Cerca servizi" />
        }
        destra={
          <>
            <Segmented
              label="Vista"
              value={vista}
              onChange={setVista}
              soloIcone="mobile"
              opzioni={[
                { value: "lista", label: "Lista", icon: List },
                { value: "mese", label: "Per mese", icon: CalendarRange },
              ]}
              className="[&>p]:sr-only"
            />
            {vista === "lista" && <PulsanteSeleziona className="h-9" />}
            <Button className="hidden sm:inline-flex" onClick={() => setCreaAperto(true)}>
              <Plus />
              Nuovo servizio
            </Button>
          </>
        }
        azzera={
          filtriAttivi
            ? () => {
                setStato("attivo");
                setTipo("tutti");
                setCliente("tutti");
                setChiPaga("tutti");
                setQuery("");
              }
            : null
        }
      >
        <FiltroChip label="Stato" value={stato} onChange={setStato} opzioni={FILTRI_STATO} disabled={scadenza !== "tutti"} />
        {tipi.length > 0 && (
          <FiltroChip label="Tipo" value={tipo} onChange={setTipo} opzioni={[{ value: "tutti", label: "Tutti" }, ...tipi]} />
        )}
        {clienti.length > 0 && (
          <FiltroChip label="Cliente" value={cliente} onChange={setCliente} opzioni={[{ value: "tutti", label: "Tutti" }, ...clienti]} />
        )}
        <FiltroChip label="Chi paga" value={chiPaga} onChange={setChiPaga} opzioni={FILTRI_CHI_PAGA} />
      </BarraFiltri>

      {filtrati.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Nessun servizio corrisponde ai filtri.</p>
      ) : vista === "lista" ? (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-xl bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/8">
          {filtrati.map((s) => (
            <li key={s.id}>
              <RigaServizio servizio={s} mostraCosti={mostraCosti} onOpen={() => apri({ tipo: "servizio", id: s.id })} />
            </li>
          ))}
        </ul>
      ) : (
        <VistaPerMese servizi={filtrati} mostraCosti={mostraCosti} onOpen={(id) => apri({ tipo: "servizio", id })} />
      )}
      {vista === "lista" && <AzioniMultipleServizi />}
      {dialog}
    </SelezioneProvider>
  );
}

function RigaServizio({
  servizio: s,
  mostraCosti,
  onOpen,
}: {
  servizio: ServizioLista;
  mostraCosti: boolean;
  onOpen: () => void;
}) {
  const selezione = useSelezione();
  const selezionando = selezione?.attiva ?? false;
  const selezionata = selezione?.selezionate.has(s.id) ?? false;
  const nome = s.nome ?? "Servizio";

  // In modalità selezione un clic sulla riga la seleziona invece di aprirla.
  function attiva(intervallo: boolean) {
    if (selezionando) selezione!.toggle(s.id, { intervallo });
    else onOpen();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      {...(selezione ? attributiSelezione(s.id) : {})}
      aria-pressed={selezionando ? selezionata : undefined}
      onClick={(e) => attiva(e.shiftKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) attiva(false);
      }}
      className={cn(
        "group flex cursor-pointer items-center gap-3 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
        selezionando && "select-none",
        selezionata && "bg-primary-soft hover:bg-primary-soft",
      )}
    >
      {selezionando && <CasellaSelezione id={s.id} etichetta={nome} />}
      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 text-left md:grid-cols-[10rem_1fr_auto_8rem_5rem]">
        <div className="order-2 col-span-2 md:order-none md:col-span-1">
          {s.stato === "attivo" ? (
            <StatoScadenzaBadge stato={s.stato_scadenza as StatoScadenza} giorni={s.giorni_alla_scadenza ?? 0} />
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">{s.stato}</span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2.5">
          <TipoIcona nome={s.tipo_icona} className="size-4 shrink-0 text-muted-foreground" aria-label={s.tipo_nome ?? undefined} />
          <div className="min-w-0">
            <p className="truncate font-medium">{s.nome}</p>
            {/* Il badge dice già «Senza scadenza»: qui restano data e fornitore. */}
            {(s.prossima_scadenza || s.fornitore) && (
              <p className="truncate text-xs text-muted-foreground">
                {[s.prossima_scadenza && formatDate(s.prossima_scadenza), s.fornitore].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="hidden md:block">
          <ClientiLoghi clienti={s.clienti} />
        </div>
        <div className="text-right text-sm">
          {mostraCosti && s.costo !== null && (
            <p className="font-medium tabular-nums">{formatCurrency(s.costo)}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {s.prossima_scadenza ? frequenza(s.frequenza ?? "annuale").label : ""}
            {mostraCosti && s.chi_paga === "io" && s.metodo_pagamento_nome && (
              <span className="block truncate">
                {etichettaMetodo({ nome: s.metodo_pagamento_nome, ultime_cifre: s.metodo_pagamento_cifre })}
              </span>
            )}
          </p>
        </div>
        <div className="hidden items-center justify-end gap-1.5 md:flex">
          {s.rinnovo_automatico && (
            <RefreshCw className="size-3.5 text-muted-foreground" aria-label="Rinnovo automatico">
              <title>Rinnovo automatico</title>
            </RefreshCw>
          )}
          {s.chi_paga === "cliente" && (
            <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">cliente</span>
          )}
        </div>
      </div>
      {!selezionando && <EliminaServizioButton servizio={{ id: s.id, nome }} className="-mr-2" />}
    </div>
  );
}

function VistaPerMese({
  servizi,
  mostraCosti,
  onOpen,
}: {
  servizi: ServizioLista[];
  mostraCosti: boolean;
  onOpen: (id: string) => void;
}) {
  const mesi = useMemo(() => {
    const oggi = todayISO();
    const [y, m] = oggi.split("-").map(Number);
    const inizio = `${y}-${String(m).padStart(2, "0")}-01`;
    const fineData = new Date(Date.UTC(y, m - 1 + 12, 0));
    const fine = fineData.toISOString().slice(0, 10);

    const gruppi = new Map<string, { servizio: ServizioLista; data: string }[]>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(y, m - 1 + i, 1));
      gruppi.set(d.toISOString().slice(0, 7), []);
    }
    for (const s of servizi) {
      if (s.stato !== "attivo" || !s.prossima_scadenza || !s.frequenza) continue;
      const date =
        s.frequenza === "una_tantum"
          ? s.prossima_scadenza >= inizio && s.prossima_scadenza <= fine
            ? [s.prossima_scadenza]
            : []
          : scadenzeNelPeriodo(s.prossima_scadenza, s.frequenza, inizio, fine);
      for (const data of date) gruppi.get(data.slice(0, 7))?.push({ servizio: s, data });
    }
    return [...gruppi].map(([mese, voci]) => ({
      mese,
      voci: voci.sort((a, b) => a.data.localeCompare(b.data)),
      aCarico: voci.reduce((t, v) => t + (v.servizio.chi_paga === "io" ? (v.servizio.costo ?? 0) : 0), 0),
      clienti: voci.reduce((t, v) => t + (v.servizio.chi_paga === "cliente" ? (v.servizio.costo ?? 0) : 0), 0),
    }));
  }, [servizi]);

  const formatterMese = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {mesi.map(({ mese, voci, aCarico, clienti }) => (
        <section key={mese} className="rounded-xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/8">
          <header className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="font-medium">{capitalize(formatterMese.format(new Date(`${mese}-01T12:00:00Z`)))}</h3>
            {mostraCosti && (
              <span className="text-sm font-medium tabular-nums" title="Costi a tuo carico">
                {formatCurrency(aCarico)}
              </span>
            )}
          </header>
          {voci.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna scadenza.</p>
          ) : (
            <ul className="space-y-1">
              {voci.map(({ servizio, data }) => (
                <li key={`${servizio.id}-${data}`} className="group flex items-center gap-1 rounded-md hover:bg-muted">
                  <button
                    type="button"
                    onClick={() => onOpen(servizio.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left text-sm"
                  >
                    <span className="w-10 shrink-0 text-xs text-muted-foreground tabular-nums">{data.slice(8, 10)}/{data.slice(5, 7)}</span>
                    <span className="min-w-0 flex-1 truncate">{servizio.nome}</span>
                    {mostraCosti && servizio.costo !== null && (
                      <span
                        className={cn("tabular-nums", servizio.chi_paga === "cliente" && "text-muted-foreground line-through decoration-muted-foreground/40")}
                        title={servizio.chi_paga === "cliente" ? "Pagato dal cliente" : undefined}
                      >
                        {formatCurrency(servizio.costo)}
                      </span>
                    )}
                  </button>
                  <EliminaServizioButton servizio={{ id: servizio.id, nome: servizio.nome ?? "Servizio" }} className="size-6" />
                </li>
              ))}
            </ul>
          )}
          {mostraCosti && clienti > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">+ {formatCurrency(clienti)} pagati dai clienti</p>
          )}
        </section>
      ))}
    </div>
  );
}
