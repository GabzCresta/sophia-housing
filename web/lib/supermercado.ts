import type { PlaceOption } from "@/lib/types";
import type { SectionStatus } from "@/lib/sections";

/* ── Seção Supermercado ──────────────────────────────────────────────────────
   Aqui a origem se inverte em relação à Moradia: a LISTA inteira é do router
   (lugares, tempos, rede, índice de preço, rating). A única tarefa humana é
   escolher "o meu" mercado — é ela que define o custo de comida depois. */

export function supermercadoStatus(places: PlaceOption[]): SectionStatus {
  if (places.length === 0) return "router"; // nada medido ainda
  if (!places.some((p) => p.selected)) return "todo"; // falta você escolher o seu
  return "ok";
}
