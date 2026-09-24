import { Suspense } from "react";

import { VaultProvider } from "@/components/credenziali/vault-provider";
import { EntityDrawer } from "@/components/drawer/entity-drawer";
import { AppHeader } from "@/components/layout/app-header";
import { AppNav, Brand } from "@/components/layout/app-nav";
import { CommandPaletteProvider } from "@/components/layout/command-palette";
import { getFiltroAmbito } from "@/lib/ambito.server";
import { getUtenteCorrente } from "@/lib/utente.server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [utente, filtroAmbito] = await Promise.all([
    getUtenteCorrente(),
    getFiltroAmbito(),
  ]);

  return (
    <VaultProvider>
      <CommandPaletteProvider>
        <div className="flex min-h-svh">
          <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-4 border-r bg-sidebar p-3 lg:flex">
            <div className="flex h-8 items-center">
              <Brand />
            </div>
            <AppNav />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <AppHeader
              filtroAmbito={filtroAmbito}
              nome={utente.nome}
              email={utente.email}
            />
            {utente.ruolo === "collaboratore" && utente.permessi === 0 && (
              <div
                role="status"
                className="border-b bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-6"
              >
                Il tuo account non ha ancora nessun permesso, quindi non vedrai
                dati né potrai crearne. Chiedi all&apos;owner di abilitarti. Se
                l&apos;owner sei tu, segui «Impostare l&apos;owner» nel README.
              </div>
            )}
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
              {children}
            </main>
          </div>
        </div>
        <Suspense>
          <EntityDrawer />
        </Suspense>
      </CommandPaletteProvider>
    </VaultProvider>
  );
}
