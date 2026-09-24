"use client";

import { CalendarIcon } from "lucide-react";
import { it } from "react-day-picker/locale";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/dates/format";
import { cn } from "@/lib/utils";

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromISODate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
}

/** Selettore di una data di calendario ("yyyy-MM-dd"), mostrata come dd/MM/yyyy. */
export function DatePicker({
  value,
  onChange,
  id,
  className,
  invalid,
  placeholder = "Scegli una data",
  clearable = false,
  size,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  invalid?: boolean;
  placeholder?: string;
  /** Mostra "Rimuovi data", che imposta il valore a "". */
  clearable?: boolean;
  size?: "sm" | "default";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = fromISODate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            size={size}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            className={cn("justify-start font-normal", !selected && "text-muted-foreground", className)}
          />
        }
      >
        <CalendarIcon />
        {selected ? formatDate(value) : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={it}
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) onChange(toISODate(date));
            setOpen(false);
          }}
        />
        {clearable && selected && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Rimuovi data
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
