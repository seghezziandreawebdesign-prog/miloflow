"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useCommandPalette } from "./command-palette";

export function SearchButton() {
  const { open } = useCommandPalette();

  return (
    <>
      <Button
        variant="outline"
        className="hidden w-60 justify-start gap-2 bg-card text-muted-foreground shadow-none md:inline-flex"
        onClick={open}
      >
        <Search />
        Cerca…
        <kbd className="ml-auto rounded-md border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
      </Button>
      <Button variant="outline" size="icon" className="md:hidden" onClick={open} aria-label="Cerca">
        <Search />
      </Button>
    </>
  );
}
