"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, ArchiveRestore, GripVertical, Pencil, Plus, Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CategoriaIcona } from "@/components/budget/categoria-icona";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { riordinaCategorie, setCategoriaArchiviata } from "@/lib/actions/budget";
import { alberoCategorie, type Categoria, type RamoCategorie } from "@/lib/budget";
import { formatCurrency } from "@/lib/dates/format";
import { cn } from "@/lib/utils";

import { CategoriaDialog } from "./categoria-dialog";

type Modifica = { categoria: Categoria | null; parent_id: string; ambito: Categoria["ambito"] };

export function CategorieSettings({ categorie }: { categorie: Categoria[] }) {
  // L'albero è stato locale (per il trascinamento) e si riallinea quando
  // arrivano categorie nuove dal server.
  const [stato, setStato] = useState({ categorie, rami: alberoCategorie(categorie) });
  if (stato.categorie !== categorie) setStato({ categorie, rami: alberoCategorie(categorie) });
  const rami = stato.rami;
  const setRami = (rami: RamoCategorie[]) => setStato((s) => ({ ...s, rami }));
  const [mostraArchiviate, setMostraArchiviate] = useState(false);
  const [editing, setEditing] = useState<Modifica | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const archiviate = categorie.filter((c) => c.archiviata).length;
  const visibili = rami.filter((r) => mostraArchiviate || !r.padre.archiviata);

  function salvaOrdine(parentId: string | null, ids: string[]) {
    startTransition(async () => {
      const result = await riordinaCategorie(parentId, ids);
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  function onDragEndPadri(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const da = rami.findIndex((r) => r.padre.id === active.id);
    const a = rami.findIndex((r) => r.padre.id === over.id);
    const nuovi = arrayMove(rami, da, a);
    setRami(nuovi);
    salvaOrdine(null, nuovi.map((r) => r.padre.id));
  }

  function onDragEndFiglie(padreId: string, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ramo = rami.find((r) => r.padre.id === padreId);
    if (!ramo) return;
    const da = ramo.figlie.findIndex((f) => f.id === active.id);
    const a = ramo.figlie.findIndex((f) => f.id === over.id);
    const figlie = arrayMove(ramo.figlie, da, a);
    setRami(rami.map((r) => (r.padre.id === padreId ? { ...r, figlie } : r)));
    salvaOrdine(padreId, figlie.map((f) => f.id));
  }

  function archivia(c: Categoria, archiviata: boolean) {
    startTransition(async () => {
      const result = await setCategoriaArchiviata(c.id, archiviata);
      if (!result.ok) toast.error(result.error);
      else toast.success(archiviata ? `${c.nome} archiviata: non compare più nelle scelte` : `${c.nome} ripristinata`);
    });
  }

  return (
    <Card id="categorie" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tags className="size-4" />
          Categorie di spesa
        </CardTitle>
        <CardDescription>
          Due livelli: categorie e sottocategorie. Trascina per ordinare. Il budget di default vale ogni mese, salvo quello impostato
          nel singolo mese. Le sottocategorie hanno l&apos;ambito del padre.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setEditing({ categoria: null, parent_id: "", ambito: "entrambi" })}>
            <Plus />
            Aggiungi
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibili.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna categoria. Aggiungi la prima.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndPadri}>
            <SortableContext items={visibili.map((r) => r.padre.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {visibili.map((ramo) => (
                  <RigaPadre
                    key={ramo.padre.id}
                    ramo={ramo}
                    mostraArchiviate={mostraArchiviate}
                    sensors={sensors}
                    onDragEndFiglie={(e) => onDragEndFiglie(ramo.padre.id, e)}
                    onModifica={(c) => setEditing({ categoria: c, parent_id: c.parent_id ?? "", ambito: c.ambito })}
                    onAggiungiFiglia={() => setEditing({ categoria: null, parent_id: ramo.padre.id, ambito: ramo.padre.ambito })}
                    onArchivia={archivia}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
        {archiviate > 0 && (
          <button type="button" className="text-xs text-muted-foreground underline underline-offset-4" onClick={() => setMostraArchiviate((v) => !v)}>
            {mostraArchiviate ? "Nascondi le archiviate" : `Mostra le archiviate (${archiviate})`}
          </button>
        )}
      </CardContent>

      {editing && (
        <CategoriaDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          categoria={editing.categoria}
          parentId={editing.parent_id}
          ambitoIniziale={editing.ambito}
          padri={rami.filter((r) => !r.padre.archiviata).map((r) => r.padre)}
        />
      )}
    </Card>
  );
}

function RigaPadre({
  ramo,
  mostraArchiviate,
  sensors,
  onDragEndFiglie,
  onModifica,
  onAggiungiFiglia,
  onArchivia,
}: {
  ramo: RamoCategorie;
  mostraArchiviate: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEndFiglie: (e: DragEndEvent) => void;
  onModifica: (c: Categoria) => void;
  onAggiungiFiglia: () => void;
  onArchivia: (c: Categoria, archiviata: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ramo.padre.id });
  const figlie = ramo.figlie.filter((f) => mostraArchiviate || !f.archiviata);
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("rounded-lg bg-card ring-1 ring-black/8", isDragging && "z-10 shadow-lg")}>
      <RigaCategoria categoria={ramo.padre} maniglia={{ attributes, listeners }} onModifica={onModifica} onArchivia={onArchivia} padre>
        <Button variant="ghost" size="icon-xs" aria-label={`Aggiungi una sottocategoria a ${ramo.padre.nome}`} onClick={onAggiungiFiglia}>
          <Plus />
        </Button>
      </RigaCategoria>
      {figlie.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndFiglie}>
          <SortableContext items={figlie.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <ul className="border-t pl-6">
              {figlie.map((f) => (
                <RigaFiglia key={f.id} categoria={f} onModifica={onModifica} onArchivia={onArchivia} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </li>
  );
}

function RigaFiglia({ categoria, onModifica, onArchivia }: { categoria: Categoria; onModifica: (c: Categoria) => void; onArchivia: (c: Categoria, a: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: categoria.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("border-b last:border-b-0", isDragging && "z-10 bg-card shadow-lg")}>
      <RigaCategoria categoria={categoria} maniglia={{ attributes, listeners }} onModifica={onModifica} onArchivia={onArchivia} />
    </li>
  );
}

function RigaCategoria({
  categoria: c,
  maniglia,
  onModifica,
  onArchivia,
  padre,
  children,
}: {
  categoria: Categoria;
  maniglia: { attributes: React.HTMLAttributes<HTMLButtonElement>; listeners: Record<string, unknown> | undefined };
  onModifica: (c: Categoria) => void;
  onArchivia: (c: Categoria, a: boolean) => void;
  padre?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-2 px-2 py-2", c.archiviata && "opacity-60")}>
      <button type="button" className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing" aria-label={`Trascina ${c.nome}`} {...maniglia.attributes} {...maniglia.listeners}>
        <GripVertical className="size-4" />
      </button>
      <CategoriaIcona nome={c.icona} colore={c.colore} size={padre ? "md" : "sm"} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", padre && "font-medium")}>{c.nome}</p>
        <p className="truncate text-xs text-muted-foreground">
          {c.ambito === "entrambi" ? "Lavoro e personale" : c.ambito === "lavoro" ? "Solo lavoro" : "Solo personale"}
          {c.budget_default !== null && ` · budget ${formatCurrency(c.budget_default)} al mese`}
          {c.archiviata && " · archiviata"}
        </p>
      </div>
      {children}
      <Button variant="ghost" size="icon-xs" onClick={() => onModifica(c)} aria-label={`Modifica ${c.nome}`}>
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={() => onArchivia(c, !c.archiviata)} aria-label={c.archiviata ? `Ripristina ${c.nome}` : `Archivia ${c.nome}`}>
        {c.archiviata ? <ArchiveRestore /> : <Archive />}
      </Button>
    </div>
  );
}
