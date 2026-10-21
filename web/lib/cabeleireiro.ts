import type { PlaceOption } from "@/lib/types";
import type { SectionStatus } from "@/lib/sections";

/* ── Seção Cabeleireiro — padrão do supermercado ─────────────────────────────
   Lista do router (busca dupla desde o início: hair_salon + barber_shop),
   tempos a pé/carro, nota do Google, link clicável e budget. */

export function cabeleireiroStatus(places: PlaceOption[]): SectionStatus {
  if (places.length === 0) return "router";
  if (!places.some((p) => p.selected)) return "todo";
  return "ok";
}

/** Link "ver no Google" — abre o lugar no Maps pelo place_id. */
export function googleMapsUrl(p: PlaceOption): string | null {
  if (!p.google_place_id) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.google_place_id}`;
}
