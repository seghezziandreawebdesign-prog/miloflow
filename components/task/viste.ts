// Viste della pagina Task, scelte con ?vista=. "tutte" e "progetti" stanno
// nel gruppo Progetti della colonna, le altre nel gruppo Viste.
export const VISTE = [
  { value: "inbox", label: "Inbox" },
  { value: "oggi", label: "Oggi" },
  { value: "settimana", label: "Prossimi 7 giorni" },
  { value: "attesa", label: "In attesa" },
  { value: "pianifica", label: "Pianifica settimana" },
  { value: "tutte", label: "Tutte le task" },
  { value: "progetti", label: "Tutti i progetti" },
] as const;
export type Vista = (typeof VISTE)[number]["value"];
