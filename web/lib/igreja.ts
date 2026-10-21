import type { PlaceOption } from "@/lib/types";
import type { SectionStatus } from "@/lib/sections";

/* ── Seção Igreja ────────────────────────────────────────────────────────────
   Lista do router (busca dupla desde o início); missa em inglês é dado SEU
   (chip cíclico ? → sim → não, PATCH /places/[id]/church); gasolina padrão. */

export function igrejaStatus(places: PlaceOption[]): SectionStatus {
  if (places.length === 0) return "router";
  if (!places.some((p) => p.selected)) return "todo";
  return "ok";
}
