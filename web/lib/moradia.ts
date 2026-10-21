import type { ApartmentFull } from "@/lib/types";
import type { SectionStatus } from "@/lib/sections";

/* ── Origem e completude da ficha Moradia ────────────────────────────────────
   A origem é propriedade do CAMPO (não do dado): cidade/bairro vêm do router
   (geocoding); o resto é humano. "Completa" = os essenciais preenchidos —
   os campos que definem custo e decisão; os demais são detalhe opcional. */

/** Os campos que o Gabriel PRECISA preencher para a ficha decidir algo. */
export const ESSENTIAL_FIELDS = [
  ["rent_base_eur", "aluguel base"],
  ["charges_type", "tipo de charges"],
  ["deposit_eur", "depósito"],
  ["unit_type", "tipo da unidade"],
  ["area_m2", "área"],
  ["furnished", "mobiliado"],
  ["lease_type", "tipo de bail"],
  ["available_from", "disponível de"],
  ["contact_info", "contato"],
] as const;

export const isEmptyVal = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** Labels dos essenciais ainda vazios — a lista "falta você". */
export function missingEssentials(f: ApartmentFull): string[] {
  return ESSENTIAL_FIELDS.filter(([key]) => isEmptyVal(f[key as keyof ApartmentFull])).map(
    ([, label]) => label,
  );
}

/** O router ainda deve algo a esta moradia? (rotas não calculadas ou geocode ausente) */
export function routerPending(f: ApartmentFull): boolean {
  return f.routes_stale || (isEmptyVal(f.city) && isEmptyVal(f.neighborhood));
}

export type { SectionStatus };

/** Status da seção para o pontinho do mini-card: sua ação primeiro, depois o router. */
export function moradiaStatus(f: ApartmentFull): SectionStatus {
  if (missingEssentials(f).length > 0) return "todo";
  if (routerPending(f)) return "router";
  return "ok";
}
