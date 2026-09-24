"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAVIGAZIONE } from "@/lib/navigazione";
import { cn } from "@/lib/utils";

export function AppNav({ onNavigate, large }: { onNavigate?: () => void; large?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {NAVIGAZIONE.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 text-sidebar-foreground/75 transition-colors hover:text-sidebar-foreground",
              large ? "py-2.5 text-[15px]" : "py-1.5 text-sm",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "hover:bg-black/4",
            )}
          >
            <Icon className={cn("shrink-0", active ? "text-primary" : "text-sidebar-foreground/60", large ? "size-5" : "size-4")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link
      href="/oggi"
      className="flex items-center gap-2 px-1 text-[15px] font-semibold tracking-tight"
      aria-label="Milo Flow, vai a Oggi"
    >
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
      >
        M
      </span>
      {!compact && <span>Milo Flow</span>}
    </Link>
  );
}
