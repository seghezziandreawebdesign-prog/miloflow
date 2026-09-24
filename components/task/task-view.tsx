"use client";

import { CalendarRange, Hourglass, Inbox, Sun } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { ambitoDiDefault, type FiltroAmbito } from "@/lib/ambito";
import { capitalize, formatLongDate, todayISO } from "@/lib/dates/format";
import { addDays } from "@/lib/dates/giorni";
import { confrontaTask, giornoTask, isInbox, prossimiGiorni, taskDiOggi } from "@/lib/task";

import { AggiuntaRapida } from "./aggiunta-rapida";
import { useTaskAperte, type TaskLista } from "./dati";
import { IntestazioneVista } from "./intestazione-vista";
import { GruppoTask, ListaSkeleton, ListaTask, Superficie } from "./liste";
import { useNuovaTask } from "./nuova-task";
import { PianificaSettimana } from "./pianifica-settimana";
import { ProgettiLista } from "./progetti-lista";
import { PulsanteNuovaTask } from "./pulsante-nuova-task";
import { SwitchListaBoard, TutteLeTask, useModoTutte } from "./tutte-le-task";
import { VISTE, type Vista } from "./viste";

const DESCRIZIONI: Partial<Record<Vista, string>> = {
  inbox: "Senza data di inizio, scadenza né progetto.",
  oggi: "In ritardo e in programma per oggi.",
  settimana: "Raggruppate per giorno.",
  attesa: "Aspettano qualcuno o qualcosa.",
  pianifica: "Trascina una task su un giorno per darle una data di inizio.",
  tutte: "Tutte le task, con i filtri.",
  progetti: "Con l'avanzamento delle task.",
};

export function TaskView({ filtroAmbito }: { filtroAmbito: FiltroAmbito }) {
  const searchParams = useSearchParams();
  const param = searchParams.get("vista");
  const vista: Vista = VISTE.some((v) => v.value === param) ? (param as Vista) : "oggi";
  const { data: tasks, isPending } = useTaskAperte(filtroAmbito);
  const [modo, setModo] = useModoTutte();

  const tutte = tasks ?? [];
  const conteggio =
    vista === "inbox"
      ? tutte.filter(isInbox).length
      : vista === "attesa"
        ? tutte.filter((t) => t.stato === "in_attesa").length
        : undefined;

  return (
    <div className="space-y-4">
      <IntestazioneVista
        titolo={VISTE.find((v) => v.value === vista)?.label ?? "Task"}
        descrizione={DESCRIZIONI[vista]}
        conteggio={conteggio}
        azioni={
          <>
            {vista === "tutte" && <SwitchListaBoard value={modo} onChange={setModo} />}
            {vista !== "progetti" && (
              <div className="hidden sm:block">
                <PulsanteNuovaTask valori={{ ambito: ambitoDiDefault(filtroAmbito) }} />
              </div>
            )}
          </>
        }
      />

      {vista === "progetti" ? (
        <ProgettiLista filtroAmbito={filtroAmbito} />
      ) : vista === "tutte" ? (
        <TutteLeTask filtroAmbito={filtroAmbito} modo={modo} />
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
        <Superficie>
          <ListaTask tasks={inbox} />
        </Superficie>
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
  return (
    <Superficie>
      <ListaTask tasks={inAttesa} />
    </Superficie>
  );
}

