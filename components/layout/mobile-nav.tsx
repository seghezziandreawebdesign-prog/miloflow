"use client";

import { LogOut, Menu } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { signOut } from "@/lib/actions/auth";

import { AppNav, Brand } from "./app-nav";

/** Menu di navigazione su mobile: il pulsante ☰ in alto a destra apre un pannello da destra. */
export function MobileNav({ nome, email }: { nome: string; email: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="rounded-full lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Apri il menu"
      >
        <Menu />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-[19rem] flex-col gap-6 bg-sidebar p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="pr-10">
            <Brand />
          </div>
          <AppNav large onNavigate={() => setOpen(false)} />
          <div className="mt-auto flex items-center gap-3 rounded-xl bg-sidebar-accent p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
              {iniziali(nome)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{nome}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Esci" onClick={() => void signOut()}>
              <LogOut />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function iniziali(nome: string): string {
  return (
    nome
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}
