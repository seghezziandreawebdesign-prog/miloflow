"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

// Tiptap pesa parecchio: così sta fuori dal bundle iniziale delle pagine
// e si scarica solo quando un editor arriva davvero a schermo.
export const EditorTesto = dynamic(
  () => import("./editor-testo").then((m) => m.EditorTesto),
  { ssr: false, loading: () => <Skeleton className="h-24 w-full rounded-md" /> },
);
