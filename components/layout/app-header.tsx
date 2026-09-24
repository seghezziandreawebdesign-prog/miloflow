import type { FiltroAmbito } from "@/lib/ambito";

import { AmbitoSwitch } from "./ambito-switch";
import { Brand } from "./app-nav";
import { MobileNav } from "./mobile-nav";
import { QuickCreate } from "./quick-create";
import { SearchButton } from "./search-button";
import { UserMenu } from "./user-menu";

/**
 * Barra in alto. Su desktop: ricerca, switch di ambito, + e account.
 * Su mobile: logo a sinistra, poi ricerca, switch e il menu ☰ a destra.
 */
export function AppHeader({
  filtroAmbito,
  nome,
  email,
}: {
  filtroAmbito: FiltroAmbito;
  nome: string;
  email: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:px-4">
      <div className="lg:hidden">
        <Brand compact />
      </div>
      <SearchButton />
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <AmbitoSwitch value={filtroAmbito} />
        <div className="hidden lg:contents">
          <QuickCreate />
          <UserMenu nome={nome} email={email} />
        </div>
        <MobileNav nome={nome} email={email} />
      </div>
    </header>
  );
}
