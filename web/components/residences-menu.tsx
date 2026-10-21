"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ellipsis, Trash2 } from "lucide-react";
import type { ApartmentListItem } from "@/lib/types";

/** Os 3 pontinhos acima do card de cadastro: lista todas as residências salvas.
 *  Cada uma vive em /r/[id]; a lixeira apaga do banco (2 cliques: armar → confirmar). */
export function ResidencesMenu({ currentId }: { currentId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ApartmentListItem[] | null>(null);
  const [armed, setArmed] = useState<string | null>(null); // lixeira clicada 1x
  const [deleting, setDeleting] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/apartments")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  // Fecha com clique fora ou Esc (e desarma a lixeira).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setArmed(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setArmed(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function remove(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/apartments/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error();
      setItems((prev) => prev?.filter((a) => a.id !== id) ?? prev);
      // Apagou a residência aberta → volta para a home (a URL dela morreu).
      if (id === currentId) router.push("/");
    } catch {
      // mantém na lista; nada foi apagado
    } finally {
      setDeleting(null);
      setArmed(null);
    }
  }

  return (
    <div ref={rootRef} className="relative flex justify-end">
      <button
        type="button"
        aria-label="Residências salvas"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`rounded-lg border px-3 py-1.5 transition-colors ${
          open
            ? "border-gold bg-gold/10 text-gold-hi"
            : "border-line bg-card text-ink-2 hover:border-gold/50 hover:text-gold-hi"
        }`}
      >
        <Ellipsis className="h-5 w-5" strokeWidth={2} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-line bg-card p-2 shadow-xl shadow-black/40">
          <p className="microlabel px-3 pb-2 pt-2 text-mute">residências salvas</p>

          {items === null && <p className="px-3 pb-3 text-sm text-mute">Carregando…</p>}
          {items?.length === 0 && (
            <p className="px-3 pb-3 text-sm text-mute">Nenhuma ainda — cadastre a primeira abaixo.</p>
          )}

          {items?.map((a) => {
            const active = a.id === currentId;
            const isArmed = armed === a.id;
            const isDeleting = deleting === a.id;
            const where = [a.neighborhood, a.city].filter(Boolean).join(" · ");
            return (
              <div
                key={a.id}
                className={`flex items-center gap-1 rounded-lg transition-colors ${
                  active ? "bg-gold/10" : "hover:bg-card-2"
                }`}
              >
                <Link
                  href={`/r/${a.id}`}
                  onClick={() => {
                    setOpen(false);
                    setArmed(null);
                  }}
                  className="min-w-0 flex-1 px-3 py-2.5"
                >
                  <span
                    className={`block truncate text-sm font-medium ${
                      active ? "text-gold-hi" : "text-ink"
                    }`}
                  >
                    {a.name}
                  </span>
                  {where && <span className="mt-0.5 block truncate text-xs text-mute">{where}</span>}
                </Link>

                <button
                  type="button"
                  disabled={isDeleting}
                  aria-label={isArmed ? `Confirmar exclusão de ${a.name}` : `Apagar ${a.name}`}
                  onClick={() => (isArmed ? remove(a.id) : setArmed(a.id))}
                  className={`mr-1.5 flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    isArmed
                      ? "bg-bad/15 text-bad"
                      : "text-mute hover:bg-bad/10 hover:text-bad"
                  } disabled:opacity-50`}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  {isArmed && (isDeleting ? "apagando…" : "apagar?")}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
