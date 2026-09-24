"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

/** Barra della pagina di stampa: nascosta nel PDF. */
export function BarraStampa({ indietro }: { indietro: string }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
      <Link href={indietro} className={buttonVariants({ variant: "outline" })}>
        <ArrowLeft />
        Torna al budget
      </Link>
      <Button onClick={() => window.print()}>
        <Printer />
        Esporta PDF
      </Button>
    </div>
  );
}
