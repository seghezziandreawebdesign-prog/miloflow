"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { completaTask, riapriTask, riordinaTask, updateTask } from "@/lib/actions/task";
import type { FiltroAmbito } from "@/lib/ambito";
import { nomeCliente } from "@/lib/clienti";
import { formatDate } from "@/lib/dates/format";
import type { RiferimentoRapido } from "@/lib/parsing/task-rapida";
import type { TaskPatch } from "@/lib/schemas/task";
import { createClient } from "@/lib/supabase/client";

// Colonne lette per le liste: la task con progetto, cliente, servizio,
// genitore (per le sottotask) e sottotask (per i conteggi).
const SELECT_TASK = `*,
  progetti(id, nome, colore),
  clienti(id, nome_breve, ragione_sociale, colore),
  servizi(id, nome),
  genitore:parent_id(id, titolo),
  sottotask:task!parent_id(id, stato)`;

async function leggiTask(build: (q: ReturnType<typeof queryBase>) => ReturnType<typeof queryBase>) {
  const { data, error } = await build(queryBase());
  if (error) throw new Error(`Lettura task non riuscita: ${error.message}`);
  return data.map(normalizzaTask);
}

function queryBase() {
  return createClient().from("task").select(SELECT_TASK);
}

type RigaTask = NonNullable<Awaited<ReturnType<typeof queryBase>>["data"]>[number];

function normalizzaTask(t: RigaTask) {
  return {
    ...t,
    cliente_nome: t.clienti ? nomeCliente(t.clienti) : null,
    sottotask_aperte: t.sottotask.filter((s) => s.stato !== "fatto").length,
    sottotask_totali: t.sottotask.length,
  };
}

export type TaskLista = ReturnType<typeof normalizzaTask>;

const filtraAmbito = <Q extends { eq: (col: "ambito", v: "lavoro" | "personale") => Q }>(q: Q, ambito: FiltroAmbito) =>
  ambito === "tutto" ? q : q.eq("ambito", ambito);

export const chiaviTask = {
  tutte: ["task"] as const,
  aperte: (ambito: FiltroAmbito) => ["task", "aperte", ambito] as const,
  archivio: (ambito: FiltroAmbito) => ["task", "archivio", ambito] as const,
  progetto: (id: string) => ["task", "progetto", id] as const,
  cliente: (id: string) => ["task", "cliente", id] as const,
  dettaglio: (id: string) => ["task", "dettaglio", id] as const,
};

/** Tutte le task non completate dell'ambito, sottotask comprese. */
export function useTaskAperte(ambito: FiltroAmbito) {
  return useQuery({
    queryKey: chiaviTask.aperte(ambito),
    queryFn: () => leggiTask((q) => filtraAmbito(q.neq("stato", "fatto"), ambito).order("ordine")),
  });
}

/** Vista "Tutte": anche le completate (le più recenti), task principali e sottotask. */
export function useTaskArchivio(ambito: FiltroAmbito) {
  return useQuery({
    queryKey: chiaviTask.archivio(ambito),
    queryFn: () =>
      leggiTask((q) =>
        filtraAmbito(q, ambito)
          .order("completata_il", { ascending: false, nullsFirst: true })
          .order("created_at", { ascending: false })
          .limit(1000),
      ),
  });
}

export function useTaskProgetto(id: string) {
  return useQuery({
    queryKey: chiaviTask.progetto(id),
    queryFn: () => leggiTask((q) => q.eq("progetto_id", id).is("parent_id", null).order("ordine")),
  });
}

export function useTaskCliente(id: string) {
  return useQuery({
    queryKey: chiaviTask.cliente(id),
    queryFn: () => leggiTask((q) => q.eq("cliente_id", id).is("parent_id", null).order("ordine")),
  });
}

// Progetti ----------------------------------------------------------------

export const chiaviProgetti = {
  tutti: ["progetti"] as const,
  lista: (ambito: FiltroAmbito) => ["progetti", "lista", ambito] as const,
  cliente: (id: string) => ["progetti", "cliente", id] as const,
  dettaglio: (id: string) => ["progetti", "dettaglio", id] as const,
};

const SELECT_PROGETTO = "*, clienti(id, nome_breve, ragione_sociale, colore)";

function normalizzaProgetto<T extends { clienti: { nome_breve: string | null; ragione_sociale: string } | null }>(p: T) {
  return { ...p, cliente_nome: p.clienti ? nomeCliente(p.clienti) : null };
}

async function leggiProgetti(filtro: { ambito?: FiltroAmbito; clienteId?: string; id?: string }) {
  let q = createClient().from("v_progetti").select(SELECT_PROGETTO);
  if (filtro.ambito && filtro.ambito !== "tutto") q = q.eq("ambito", filtro.ambito);
  if (filtro.clienteId) q = q.eq("cliente_id", filtro.clienteId);
  if (filtro.id) q = q.eq("id", filtro.id);
  const { data, error } = await q.order("nome");
  if (error) throw new Error(`Lettura progetti non riuscita: ${error.message}`);
  return data.map(normalizzaProgetto);
}

export type ProgettoLista = Awaited<ReturnType<typeof leggiProgetti>>[number];

export function useProgetti(ambito: FiltroAmbito) {
  return useQuery({ queryKey: chiaviProgetti.lista(ambito), queryFn: () => leggiProgetti({ ambito }) });
}

export function useProgettiCliente(clienteId: string) {
  return useQuery({ queryKey: chiaviProgetti.cliente(clienteId), queryFn: () => leggiProgetti({ clienteId }) });
}

export function useProgetto(id: string) {
  return useQuery({
    queryKey: chiaviProgetti.dettaglio(id),
    queryFn: async () => (await leggiProgetti({ id }))[0] ?? null,
  });
}

// Opzioni dei form e riferimenti dell'aggiunta rapida ---------------------

export type OpzioniTask = {
  clienti: { id: string; nome: string }[];
  progetti: { id: string; nome: string; cliente_id: string | null; ambito: "lavoro" | "personale" }[];
  utenti: { id: string; nome: string }[];
  riferimenti: RiferimentoRapido[];
};

async function caricaOpzioni(): Promise<OpzioniTask> {
  const supabase = createClient();
  const [clienti, progetti, utenti] = await Promise.all([
    supabase.from("clienti").select("id, nome_breve, ragione_sociale").neq("stato", "archiviato").order("ragione_sociale"),
    supabase.from("progetti").select("id, nome, cliente_id, ambito").in("stato", ["attivo", "in_pausa"]).order("nome"),
    supabase.from("profili").select("id, nome").order("nome"),
  ]);
  const listaClienti = (clienti.data ?? []).map((c) => ({ id: c.id, nome: nomeCliente(c), ragione: c.ragione_sociale }));
  const listaProgetti = progetti.data ?? [];
  return {
    clienti: listaClienti.map(({ id, nome }) => ({ id, nome })),
    progetti: listaProgetti,
    utenti: (utenti.data ?? []).map((u) => ({ id: u.id, nome: u.nome ?? "Senza nome" })),
    riferimenti: [
      ...listaProgetti.map((p): RiferimentoRapido => ({
        tipo: "progetto", id: p.id, nome: p.nome, clienteId: p.cliente_id, ambito: p.ambito,
      })),
      ...listaClienti.map((c): RiferimentoRapido => ({
        tipo: "cliente", id: c.id, nome: c.nome, alias: c.ragione !== c.nome ? [c.ragione] : [],
      })),
    ],
  };
}

export function useOpzioniTask() {
  return useQuery({ queryKey: ["opzioni-task"], queryFn: caricaOpzioni, staleTime: 60_000 });
}

// Mutazioni -----------------------------------------------------------------

/** Dopo ogni scrittura: liste, progetti e pagine renderizzate dal server. */
export function invalidaTask(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: chiaviTask.tutte });
  void queryClient.invalidateQueries({ queryKey: chiaviProgetti.tutti });
}

type ConId = { id: string };

/** Applica una modifica a una task in tutte le liste in cache (aggiornamento ottimistico). */
function aggiornaInCache(queryClient: QueryClient, id: string, patch: Record<string, unknown>) {
  queryClient.setQueriesData<unknown>({ queryKey: chiaviTask.tutte }, (old: unknown) => {
    if (Array.isArray(old)) {
      return old.map((t: ConId) => (t.id === id ? { ...t, ...patch } : t));
    }
    if (old && typeof old === "object" && "task" in old) {
      const d = old as { task: ConId; sottotask?: ConId[] };
      return {
        ...d,
        task: d.task.id === id ? { ...d.task, ...patch } : d.task,
        sottotask: d.sottotask?.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      };
    }
    return old;
  });
}

async function annullaCache(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: chiaviTask.tutte });
}

/**
 * Spunta: completa (con eventuali sottotask) o riapre una task, con
 * aggiornamento ottimistico e toast con "Annulla".
 */
export function useSpuntaTask() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const completa = useMutation({
    mutationFn: async ({ id, sottotask }: { id: string; sottotask?: boolean; titolo: string }) => {
      const result = await completaTask(id, { sottotask });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onMutate: async ({ id }) => {
      await annullaCache(queryClient);
      aggiornaInCache(queryClient, id, { stato: "fatto" });
    },
    onError: (error) => toast.error(error.message),
    onSuccess: (data, { id, titolo }) => {
      const prossima = data.prossima;
      toast.success(`Completata: ${titolo}`, {
        description: prossima?.data ? `Prossima occorrenza il ${formatDate(prossima.data)}` : undefined,
        action: prossima
          ? undefined
          : { label: "Annulla", onClick: () => riapri.mutate({ id }) },
      });
    },
    onSettled: () => {
      invalidaTask(queryClient);
      router.refresh();
    },
  });

  const riapri = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const result = await riapriTask(id);
      if (!result.ok) throw new Error(result.error);
    },
    onMutate: async ({ id }) => {
      await annullaCache(queryClient);
      aggiornaInCache(queryClient, id, { stato: "da_fare" });
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      invalidaTask(queryClient);
      router.refresh();
    },
  });

  return { completa, riapri };
}

/** Modifica di uno o più campi, con aggiornamento ottimistico. */
export function useAggiornaTask() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskPatch; cache?: Record<string, unknown> }) => {
      const result = await updateTask(id, patch);
      if (!result.ok) throw new Error(result.error);
    },
    onMutate: async ({ id, cache }) => {
      if (!cache) return;
      await annullaCache(queryClient);
      aggiornaInCache(queryClient, id, cache);
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      invalidaTask(queryClient);
      router.refresh();
    },
  });
}

/** Una task con le sue sottotask, per il pannello. */
export function useTaskDettaglio(id: string) {
  return useQuery({
    queryKey: chiaviTask.dettaglio(id),
    queryFn: async () => {
      const [task, sottotask] = await Promise.all([
        leggiTask((q) => q.eq("id", id)),
        leggiTask((q) => q.eq("parent_id", id).order("ordine").order("created_at")),
      ]);
      return task[0] ? { task: task[0], sottotask } : null;
    },
  });
}

/** Kanban: nuova colonna e posizione, con aggiornamento ottimistico. */
export function useRiordinaTask() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; stato: "da_fare" | "in_corso" | "in_attesa"; ordine: number; in_attesa_di?: string }) => {
      const result = await riordinaTask(id, input);
      if (!result.ok) throw new Error(result.error);
    },
    onMutate: async ({ id, stato, ordine, in_attesa_di }) => {
      await annullaCache(queryClient);
      aggiornaInCache(queryClient, id, { stato, ordine, ...(in_attesa_di !== undefined ? { in_attesa_di } : {}) });
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      invalidaTask(queryClient);
      router.refresh();
    },
  });
}
