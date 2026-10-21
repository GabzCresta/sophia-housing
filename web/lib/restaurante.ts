import type { PlaceOption } from "@/lib/types";
import type { SectionStatus } from "@/lib/sections";

/* ── Seção Restaurante ───────────────────────────────────────────────────────
   A lista é do router (lugares, tempos, cozinha inferida, faixa €, nota).
   Tarefa humana: marcar "o meu do dia a dia" — âncora de custo por saída. */

export function restauranteStatus(places: PlaceOption[]): SectionStatus {
  if (places.length === 0) return "router";
  if (!places.some((p) => p.selected)) return "todo";
  return "ok";
}
