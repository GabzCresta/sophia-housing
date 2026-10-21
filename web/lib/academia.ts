import type { GymOption } from "@/lib/types";
import type { SectionStatus } from "@/lib/sections";

/* ── Seção Academia ──────────────────────────────────────────────────────────
   Lista do router + academias manuais; preços das redes (Fitness Park,
   Basic-Fit) pesquisados e pré-preenchidos, o resto é editável. A mensalidade
   da ESCOLHIDA entra no custo de vida (gym_eur na view). */

export function academiaStatus(gyms: GymOption[]): SectionStatus {
  if (gyms.length === 0) return "router";
  if (!gyms.some((g) => g.selected)) return "todo";
  return "ok";
}
