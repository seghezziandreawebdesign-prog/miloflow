"use client";

import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Intestazione dei pannelli delle entità (task, progetto, servizio, cliente),
// che si aprono nella finestra centrata di EntityDrawer.

export function PannelloHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="pannello-header" className={cn("flex flex-col gap-1 p-4 sm:p-5", className)} {...props} />;
}

export function PannelloTitle({ className, ...props }: React.ComponentProps<typeof DialogTitle>) {
  return <DialogTitle className={cn("text-lg leading-snug font-semibold tracking-tight", className)} {...props} />;
}

export function PannelloDescription({ className, ...props }: React.ComponentProps<typeof DialogDescription>) {
  return <DialogDescription className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
