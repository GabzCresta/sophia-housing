"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { MapData } from "@/lib/types";

// Leaflet não roda em SSR — o miolo entra só no cliente (ssr: false exige
// estar dentro de um client component; por isso o dynamic vive aqui).
const VidaMapaLeaflet = dynamic(
  () => import("@/components/vida-mapa-leaflet").then((m) => m.VidaMapaLeaflet),
  { ssr: false },
);

/* ── O céu no mapa — o sol + as escolhas, no espaço. ─────────────────────────
   Recarrega quando qualquer seção grava algo (evento sophia:changed, mesmo
   padrão do GastosResumo) e no focus. key={apartment.id} remonta o Leaflet ao
   trocar de residência (re-enquadra); trocar uma seleção só atualiza os pins,
   sem roubar o zoom do usuário. */
export function VidaMapa({ apartmentId }: { apartmentId: string }) {
  const [data, setData] = useState<MapData | null>(null);

  const load = useCallback(() => {
    fetch(`/api/apartments/${apartmentId}/map`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, [apartmentId]);

  useEffect(() => {
    load();
    window.addEventListener("sophia:changed", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("sophia:changed", load);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  // sem geocode ainda = residência não medida; o RouterNotice do quadro conduz
  if (!data || data.apartment.lat == null || data.apartment.lng == null) return null;

  return (
    <section className="mt-10 w-full rounded-2xl border border-line bg-card p-6">
      <p className="microlabel text-gold-hi">o céu no mapa</p>
      <h2 className="mt-3 font-display text-xl font-semibold">
        Tudo em volta de {data.apartment.name}
      </h2>
      <p className="mt-1 text-sm text-mute">
        O sol e as suas escolhas — clique num pin para ver o que é e a distância.
      </p>
      <div className="mt-4 h-[440px] overflow-hidden rounded-xl border border-line">
        <VidaMapaLeaflet key={data.apartment.id} data={data} />
      </div>
    </section>
  );
}
