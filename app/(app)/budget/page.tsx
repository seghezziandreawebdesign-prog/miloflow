import { Wallet } from "lucide-react";
import type { Metadata } from "next";

import { BudgetHeader, type TabBudget } from "@/components/budget/budget-header";
import { DebitiView } from "@/components/budget/debiti-view";
import { MeseView } from "@/components/budget/mese-view";
import { ReportView } from "@/components/budget/report-view";
import { EmptyState } from "@/components/empty-state";
import { getFiltroAmbito } from "@/lib/ambito.server";
import {
  abbonamentiAnnui,
  fisseVsVariabili,
  intervalloReport,
  isPeriodoReport,
  marginePerCliente,
  primoDelMese,
  spesaPerCategoria,
  spesaPerMese,
  spesaPerMetodo,
  totaliMese,
  ultimiMesi,
  type PeriodoReport,
} from "@/lib/budget";
import { todayISO } from "@/lib/dates/format";
import {
  leggiAbbonamenti,
  leggiBudgetMese,
  leggiCategorie,
  leggiDebiti,
  leggiMetodi,
  leggiMovimentiMese,
  leggiMovimentiPeriodo,
  leggiRivendite,
  permessiBudget,
} from "@/lib/queries/budget";

export const metadata: Metadata = { title: "Budget" };

const TABS: TabBudget[] = ["mese", "debiti", "report"];

export default async function Page({ searchParams }: PageProps<"/budget">) {
  const params = await searchParams;
  const tab = TABS.find((t) => t === params.tab) ?? "mese";
  const oggi = todayISO();
  const meseParam = typeof params.mese === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.mese) ? params.mese : oggi;
  const mese = primoDelMese(meseParam);
  const periodo: PeriodoReport = isPeriodoReport(typeof params.periodo === "string" ? params.periodo : undefined)
    ? (params.periodo as PeriodoReport)
    : "mese";
  const [filtroAmbito, permessi] = await Promise.all([getFiltroAmbito(), permessiBudget()]);

  if (!permessi.lettura) {
    return (
      <>
        <BudgetHeader tab={tab} mese={mese} filtroAmbito={filtroAmbito} periodo={periodo} />
        <EmptyState icon={Wallet} title="Budget non disponibile" description="Serve il permesso «budget»: chiedilo all'owner." />
      </>
    );
  }

  return (
    <>
      <BudgetHeader tab={tab} mese={mese} filtroAmbito={filtroAmbito} periodo={periodo} />
      {tab === "mese" && <TabMese mese={mese} filtroAmbito={filtroAmbito} oggi={oggi} scrittura={permessi.scrittura} owner={permessi.owner} />}
      {tab === "debiti" && <TabDebiti filtroAmbito={filtroAmbito} oggi={oggi} scrittura={permessi.scrittura} />}
      {tab === "report" && <TabReport periodo={periodo} filtroAmbito={filtroAmbito} oggi={oggi} />}
    </>
  );
}

async function TabMese({
  mese,
  filtroAmbito,
  oggi,
  scrittura,
  owner,
}: {
  mese: string;
  filtroAmbito: Awaited<ReturnType<typeof getFiltroAmbito>>;
  oggi: string;
  scrittura: boolean;
  owner: boolean;
}) {
  const [movimenti, categorie, budgetMensili] = await Promise.all([
    leggiMovimentiMese(mese, filtroAmbito),
    leggiCategorie(),
    leggiBudgetMese(mese),
  ]);
  const totali = totaliMese(movimenti, categorie, budgetMensili, filtroAmbito);
  return (
    <MeseView
      mese={mese}
      oggi={oggi}
      movimenti={movimenti}
      categorie={categorie}
      totali={totali}
      scrittura={scrittura}
      owner={owner}
    />
  );
}

async function TabDebiti({
  filtroAmbito,
  oggi,
  scrittura,
}: {
  filtroAmbito: Awaited<ReturnType<typeof getFiltroAmbito>>;
  oggi: string;
  scrittura: boolean;
}) {
  const debiti = await leggiDebiti(filtroAmbito);
  return <DebitiView debiti={debiti} oggi={oggi} filtroAmbito={filtroAmbito} scrittura={scrittura} />;
}

async function TabReport({
  periodo,
  filtroAmbito,
  oggi,
}: {
  periodo: PeriodoReport;
  filtroAmbito: Awaited<ReturnType<typeof getFiltroAmbito>>;
  oggi: string;
}) {
  const { dal, al } = intervalloReport(periodo, oggi);
  const mesi = ultimiMesi(primoDelMese(oggi), 12);
  const [movimenti, dodiciMesi, categorie, metodi, servizi, rivendite] = await Promise.all([
    leggiMovimentiPeriodo(dal, al, filtroAmbito),
    leggiMovimentiPeriodo(mesi[0], al, filtroAmbito),
    leggiCategorie(),
    leggiMetodi(),
    leggiAbbonamenti(filtroAmbito),
    filtroAmbito === "personale" ? Promise.resolve([]) : leggiRivendite(),
  ]);
  return (
    <ReportView
      periodo={periodo}
      intervallo={{ dal, al }}
      filtroAmbito={filtroAmbito}
      perCategoria={spesaPerCategoria(movimenti, categorie)}
      perMese={spesaPerMese(dodiciMesi, mesi)}
      fisseVariabili={fisseVsVariabili(movimenti)}
      abbonamenti={abbonamentiAnnui(servizi)}
      margini={marginePerCliente(rivendite)}
      perMetodo={spesaPerMetodo(movimenti, metodi)}
      totaleMovimenti={movimenti.length}
    />
  );
}
