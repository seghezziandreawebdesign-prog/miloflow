// Pagine di stampa: senza sidebar né header, pensate per "Salva come PDF".
export default function StampaLayout({ children }: LayoutProps<"/">) {
  return <div className="mx-auto max-w-4xl bg-white px-6 py-8 text-[13px] text-foreground print:max-w-none print:px-0 print:py-0">{children}</div>;
}
