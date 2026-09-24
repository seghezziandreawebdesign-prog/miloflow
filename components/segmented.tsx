import { cn } from "@/lib/utils";

/** Scelta tra poche opzioni, come pulsanti affiancati. `label` vuota: nessuna etichetta visibile. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  opzioni,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  opzioni: readonly { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && <p className="text-sm font-medium">{label}</p>}
      <div role="radiogroup" aria-label={label || undefined} className="inline-flex flex-wrap rounded-lg bg-muted p-0.5">
        {opzioni.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-3 py-1 text-sm text-muted-foreground",
              value === o.value && "bg-background font-medium text-foreground shadow-sm",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
