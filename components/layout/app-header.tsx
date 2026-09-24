import type { FiltroAmbito } from "@/lib/ambito";

import { AmbitoSwitch } from "./ambito-switch";
import { MobileNav } from "./mobile-nav";
import { QuickCreate } from "./quick-create";
import { SearchButton } from "./search-button";
import { UserMenu } from "./user-menu";

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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
      <MobileNav />
      <SearchButton />
      <div className="ml-auto flex items-center gap-2">
        <AmbitoSwitch value={filtroAmbito} />
        <QuickCreate />
        <UserMenu nome={nome} email={email} />
      </div>
    </header>
  );
}
