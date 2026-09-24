"use client";

import { CalendarRange, Hourglass, Inbox, Sun } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ambitoDiDefault, type FiltroAmbito } from "@/lib/ambito";
import { capitalize, formatLongDate, todayISO } from "@/lib/dates/format";
import { addDays } from "@/lib/dates/giorni";
import { confrontaTask, giornoTask, isInbox, prossimiGiorni, taskDiOggi } from "@/lib/task";

import { AggiuntaRapida } from "./aggiunta-rapida";
import { Board } from "./board";
import { useTaskAperte, type TaskLista } from "./dati";
import { GruppoTask, ListaSkeleton, ListaTask } from "./liste";
import { useNuovaTask } from "./nuova-task";
import { PianificaSettimana } from "./pianifica-settimana";
import { ProgettiLista } from "./progetti-lista";
import { TutteTabella } from "./tutte-tabella";

export const VISTE = [
  { value: "inbox", label: "Inbox" },
  { value: "oggi", label: "Oggi" },
  { value: "settimana", label: "Prossimi 7 giorni" },
  { value: "board", label: "Board" },
  { value: "progetti", label: "Progetti" },
  { value: "attesa", label: "In attesa" },
  { value: "tutte", label: "Tutte" },
  { value: "pianifica", label: "Pianifica settimana" },
] as const;
export type Vista = (typeof VISTE)[number]["value"];

export function TaskView({ filtroAmbito }: { filtroAmbito: FiltroAmbito }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = searchParams.get("vista");
  const vista: Vista = VISTE.some((v) => v.value === param) ? (param as Vista) : "oggi";
  const { data: tasks, isPending } = useTaskAperte(filtroAmbito);
  const oggi = todayISO();

  function setVista(v: Vista) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("vista", v);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const tutte = tasks ?? [];
  const conteggi: Partial<Record<Vista, number>> = {
    inbox: tutte.filter(isInbox).length,
    oggi: (() => {
      const r = taskDiOggi(tutte, oggi);
      return r.inRitardo.length + r.perOggi.length;
    })(),
    attesa: tutte.filter((t) => t.stato === "in_attesa").length,
  };

  return (
    <Tabs value={vista} onValueChange={(v) => setVista(v as Vista)}>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList variant="line" className="w-max">
          {VISTE.map((v) => (
            <TabsTrigger key={v.value} value={v.value}>
              {v.label}
              {(conteggi[v.value] ?? 0) > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1.5 text-xs tabular-nums">{conteggi[v.value]}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <div className="pt-4">
        {vista === "progetti" ? (
          <ProgettiLista filtroAmbito={filtroAmbito} />
        ) : vista === "tutte" ? (
          <TutteTabella filtroAmbito={filtroAmbito} />
        ) : vista === "board" ? (
          <Board filtroAmbito={filtroAmbito} />
        ) : isPending ? (
          <ListaSkeleton />
        ) : vista === "inbox" ? (
          <VistaInbox tasks={tutte} filtroAmbito={filtroAmbito} />
        ) : vista === "oggi" ? (
          <VistaOggi tasks={tutte} filtroAmbito={filtroAmbito} />
        ) : vista === "settimana" ? (
          <VistaSettimana tasks={tutte} filtroAmbito={filtroAmbito} />
        ) : vista === "attesa" ? (
          <VistaAttesa tasks={tutte} />
        ) : (
          <PianificaSettimana tasks={tutte} />
        )}
      </div>
    </Tabs>
  );
}

function VistaInbox({ tasks, filtroAmbito }: { tasks: TaskLista[]; filtroAmbito: FiltroAmbito }) {
  const inbox = tasks.filter(isInbox).sort(confrontaTask);
  return (
    <div className="space-y-4">
      <AggiuntaRapida defaults={{ ambito: ambitoDiDefault(filtroAmbito) }} />
      {inbox.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Inbox vuota"
          description="Qui finiscono le task senza data di inizio, senza scadenza e senza progetto."
        />
      ) : (
        <ListaTask tasks={inbox} />
      )}
    </div>
  );
}

/** Vista Oggi della pagina Task: ritardi e task di oggi. */
export function VistaOggi({ tasks, filtroAmbito }: { tasks: TaskLista[]; filtroAmbito: FiltroAmbito }) {
  const oggi = todayISO();
  const { inRitardo, perOggi } = taskDiOggi(tasks, oggi);
  return (
    <div className="space-y-6">
      <AggiuntaRapida
        defaults={{ ambito: ambitoDiDefault(filtroAmbito), data_pianificata: oggi }}
        placeholder="Aggiungi una task per oggi"
      />
      {inRitardo.length === 0 && perOggi.length === 0 ? (
        <EmptyState icon={Sun} title="Niente per oggi" description="Nessuna task che inizia o scade oggi." />
      ) : (
        <>
          {inRitardo.length > 0 && (
            <GruppoTask titolo="In ritardo" conteggio={inRitardo.length} tono="ritardo">
              <ListaTask tasks={inRitardo} />
            </GruppoTask>
          )}
          {perOggi.length > 0 && (
            <GruppoTask titolo={capitalize(formatLongDate(oggi))} conteggio={perOggi.length}>
              <ListaTask tasks={perOggi} opzioni={{ senzaData: true }} />
            </GruppoTask>
          )}
        </>
      )}
    </div>
  );
}

function VistaSettimana({ tasks, filtroAmbito }: { tasks: TaskLista[]; filtroAmbito: FiltroAmbito }) {
  const oggi = todayISO();
  const nuovaTask = useNuovaTask();
  const giorni = prossimiGiorni(oggi, 7);
  const ultimo = addDays(oggi, 6);
  const aperte = tasks.filter((t) => t.stato !== "fatto").sort(confrontaTask);
  const inRitardo = aperte.filter((t) => {
    const g = giornoTask(t);
    return g !== null && g < oggi;
  });
  const nelPeriodo = aperte.filter((t) => {
    const g = giornoTask(t);
    return g !== null && g >= oggi && g <= ultimo;
  });

  return (
    <div className="space-y-6">
      {inRitardo.length > 0 && (
        <GruppoTask titolo="In ritardo" conteggio={inRitardo.length} tono="ritardo">
          <ListaTask tasks={inRitardo} />
        </GruppoTask>
      )}
      {giorni.map((giorno) => {
        const delGiorno = nelPeriodo.filter((t) => giornoTask(t) === giorno);
        const titolo = giorno === oggi ? `Oggi · ${formatLongDate(giorno)}` : capitalize(formatLongDate(giorno));
        return (
          <GruppoTask
            key={giorno}
            titolo={titolo}
            conteggio={delGiorno.length}
            azione={{
              label: "Aggiungi",
              onClick: () => nuovaTask({ ambito: ambitoDiDefault(filtroAmbito), data_pianificata: giorno }),
            }}
          >
            <ListaTask tasks={delGiorno} opzioni={{ senzaData: true }} vuoto="Niente in programma." />
          </GruppoTask>
        );
      })}
      {nelPeriodo.length === 0 && inRitardo.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          <CalendarRange className="mr-1 inline size-4" />
          Nessuna task nei prossimi 7 giorni.
        </p>
      )}
    </div>
  );
}

function VistaAttesa({ tasks }: { tasks: TaskLista[] }) {
  const inAttesa = tasks
    .filter((t) => t.stato === "in_attesa")
    .sort((a, b) => (a.in_attesa_dal ?? "").localeCompare(b.in_attesa_dal ?? ""));
  if (inAttesa.length === 0) {
    return (
      <EmptyState
        icon={Hourglass}
        title="Niente in attesa"
        description="Quando una task aspetta qualcuno o qualcosa, mettila «In attesa» dal suo pannello."
      />
    );
  }
  return <ListaTask tasks={inAttesa} />;
}

