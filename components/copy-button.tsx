"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copiato`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copia non riuscita");
    }
  }

  return (
    <Button variant="ghost" size="icon-xs" onClick={copy} aria-label={`Copia ${label}`}>
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}
