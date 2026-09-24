"use client";

import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { testoInHtml } from "@/lib/testo-ricco";
import { cn } from "@/lib/utils";

/**
 * Editor WYSIWYG con formattazione essenziale: titoli, grassetto, corsivo,
 * sottolineato, barrato, elenchi, checklist, citazione, codice, link.
 * Il valore è HTML; l'editor accetta solo gli elementi del suo schema, quindi
 * script e HTML arbitrario vengono scartati sia in scrittura sia in lettura.
 *
 * `onChange` scatta quando si esce dall'editor (salvataggio al blur), oppure a
 * ogni modifica con `aggiornaSubito`.
 */
export function EditorTesto({
  value,
  onChange,
  placeholder = "Aggiungi una descrizione…",
  aggiornaSubito = false,
  id,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  aggiornaSubito?: boolean;
  id?: string;
  className?: string;
}) {
  const leggi = (editor: Editor) => (editor.isEmpty ? "" : editor.getHTML());
  // Le callback dell'editor restano quelle della creazione: valore e onChange
  // aggiornati passano da qui.
  const ultimo = useRef({ value, onChange });
  useEffect(() => {
    ultimo.current = { value, onChange };
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: true,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto", "tel"],
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: testoInHtml(value),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        "aria-label": "Descrizione",
        class: "editor-testo min-h-24 px-3 py-2 outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      if (aggiornaSubito) ultimo.current.onChange(leggi(editor));
    },
    onBlur: ({ editor }) => {
      if (aggiornaSubito) return;
      const html = leggi(editor);
      if (html !== ultimo.current.value) ultimo.current.onChange(html);
    },
  });

  // Se il valore cambia da fuori (salvataggio da un'altra scheda, refetch)
  // e l'editor non è in uso, si riallinea.
  const [origine, setOrigine] = useState(value);
  if (editor && value !== origine) {
    setOrigine(value);
    if (!editor.isFocused && leggi(editor) !== value) {
      editor.commands.setContent(testoInHtml(value), { emitUpdate: false });
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      {editor && <Barra editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Barra({ editor }: { editor: Editor }) {
  const stato = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();

  const gruppi: { icona: LucideIcon; label: string; attivo?: boolean; disabilitato?: boolean; azione: () => void }[][] = [
    [
      { icona: Heading2, label: "Titolo", attivo: stato.h2, azione: () => c().toggleHeading({ level: 2 }).run() },
      { icona: Heading3, label: "Sottotitolo", attivo: stato.h3, azione: () => c().toggleHeading({ level: 3 }).run() },
    ],
    [
      { icona: Bold, label: "Grassetto", attivo: stato.bold, azione: () => c().toggleBold().run() },
      { icona: Italic, label: "Corsivo", attivo: stato.italic, azione: () => c().toggleItalic().run() },
      { icona: Underline, label: "Sottolineato", attivo: stato.underline, azione: () => c().toggleUnderline().run() },
      { icona: Strikethrough, label: "Barrato", attivo: stato.strike, azione: () => c().toggleStrike().run() },
      { icona: Code, label: "Codice", attivo: stato.code, azione: () => c().toggleCode().run() },
    ],
    [
      { icona: List, label: "Elenco puntato", attivo: stato.bullet, azione: () => c().toggleBulletList().run() },
      { icona: ListOrdered, label: "Elenco numerato", attivo: stato.ordered, azione: () => c().toggleOrderedList().run() },
      { icona: ListChecks, label: "Checklist", attivo: stato.task, azione: () => c().toggleTaskList().run() },
      { icona: Quote, label: "Citazione", attivo: stato.quote, azione: () => c().toggleBlockquote().run() },
    ],
    [
      { icona: Undo2, label: "Annulla", disabilitato: !stato.undo, azione: () => c().undo().run() },
      { icona: Redo2, label: "Ripeti", disabilitato: !stato.redo, azione: () => c().redo().run() },
    ],
  ];

  return (
    <div role="toolbar" aria-label="Formattazione" className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
      {gruppi.map((gruppo, i) => (
        <div key={i} className="flex items-center gap-0.5 border-r pr-1 last:border-r-0 [&:not(:first-child)]:pl-1">
          {gruppo.map((b) => (
            <Pulsante key={b.label} {...b} />
          ))}
          {i === 1 && <PulsanteLink editor={editor} attivo={stato.link} />}
        </div>
      ))}
    </div>
  );
}

function Pulsante({
  icona: Icona,
  label,
  attivo,
  disabilitato,
  azione,
}: {
  icona: LucideIcon;
  label: string;
  attivo?: boolean;
  disabilitato?: boolean;
  azione: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={attivo}
      disabled={disabilitato}
      // mousedown: il focus resta nell'editor, così il blur non salva a metà.
      onMouseDown={(e) => e.preventDefault()}
      onClick={azione}
      className={cn(
        "grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40",
        attivo && "bg-muted text-foreground",
      )}
    >
      <Icona className="size-4" />
    </button>
  );
}

function PulsanteLink({ editor, attivo }: { editor: Editor; attivo: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  function applica() {
    const valore = url.trim();
    const catena = editor.chain().focus().extendMarkRange("link");
    if (!valore) catena.unsetLink().run();
    else catena.setLink({ href: /^[a-z]+:/i.test(valore) ? valore : `https://${valore}` }).run();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setUrl(editor.getAttributes("link").href ?? "");
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            title="Link"
            aria-label="Link"
            aria-pressed={attivo}
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              "grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
              attivo && "bg-muted text-foreground",
            )}
          />
        }
      >
        <Link2 className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 p-2" align="start">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          autoFocus
          aria-label="Indirizzo del link"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applica();
            }
          }}
        />
        <div className="flex justify-end gap-2">
          {attivo && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setOpen(false);
              }}
            >
              Rimuovi
            </Button>
          )}
          <Button type="button" size="sm" onClick={applica}>
            Applica
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
