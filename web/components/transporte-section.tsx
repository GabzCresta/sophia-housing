"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Group,
  Notice,
  NumberField,
  SaveIndicator,
  useAutosave,
  type SaveState,
} from "@/components/section-ui";
import { TRANSIT_PLANS } from "@/lib/transporte";
import type { ConfigData, MobilityDetail } from "@/lib/types";

/* ── Seção Transporte público (molde do kit) ─────────────────────────────────
   Os planos da região pesquisados nos sites oficiais (jul/2026): você escolhe
   o seu; o preço mensal grava em transit_config (o custo de vida lê de lá) e
   fica editável. O router entra com gare mais próxima e tempos até a SKEMA. */

export function TransporteSection({
  apartmentId,
  onChanged,
}: {
  apartmentId: string;
  onChanged: () => void;
}) {
  const [cfg, setCfg] = useState<ConfigData | null>(null);
  const [mob, setMob] = useState<MobilityDetail | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [chooseState, setChooseState] = useState<SaveState>("idle");

  const loadCfg = useCallback(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCfg(d))
      .catch(() => setCfg(null));
    onChanged(); // o dot do mini-card também depende do config
  }, [onChanged]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCfg(d))
      .catch(() => setCfg(null));
    fetch(`/api/apartments/${apartmentId}/pillar/mobility`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMob(d))
      .catch(() => setMob(null));
  }, [apartmentId]);

  // Preço mensal do passe — editável (SudAzur por zonas, avulso por uso…).
  const { patch: patchTransit, state: saveState } = useAutosave(
    "/api/config/transit",
    loadCfg,
    "PUT",
  );
  // Nome do plano escolhido vive nas settings.
  const { patch: patchSettings } = useAutosave("/api/config/settings", loadCfg, "PUT");

  const chosenKey = cfg?.settings.transit_plan ?? null;
  const passEur = cfg?.transit?.student_pass_eur ?? null;

  async function choosePlan(key: string, monthlyEur: number) {
    setChoosing(key);
    setChooseState("saving");
    try {
      const okPlan = await patchSettings({ transit_plan: key });
      const okPrice = await patchTransit({ student_pass_eur: monthlyEur });
      setChooseState(okPlan && okPrice ? "saved" : "error");
    } finally {
      setChoosing(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-mute">
          Planos pesquisados nos sites oficiais (jul/2026) — preços mudam, os links estão em cada
          card. Escolha o seu; o valor vira seu custo mensal de transporte.
        </p>
        <SaveIndicator state={saveState === "idle" ? chooseState : saveState} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Notice tone="info">
          <span className="font-medium text-ink">Router:</span>{" "}
          {mob?.nearest_gare_name
            ? `${mob.nearest_gare_name} a ${mob.nearest_gare_min ?? "—"} min a pé`
            : "gare mais próxima ainda não medida"}
          {mob?.campus_transit_min != null && (
            <> · SKEMA de transporte público: {mob.campus_transit_min} min</>
          )}
          {mob?.campus_drive_min != null && <> · de carro: {mob.campus_drive_min} min</>}
        </Notice>
        {passEur != null ? (
          <Notice tone="ok">
            Seu passe: <span className="font-medium text-ink">
              {TRANSIT_PLANS.find((p) => p.key === chosenKey)?.name ?? "personalizado"}
            </span>{" "}
            — €{String(passEur).replace(".", ",")}/mês no custo de vida.
          </Notice>
        ) : (
          <Notice tone="todo">
            <span className="font-medium text-ink">Falta você (1):</span> escolher o seu plano de
            transporte — ele entra direto no custo de vida mensal.
          </Notice>
        )}
      </div>

      {/* os planos da região */}
      <div className="mt-4 grid items-start gap-3 md:grid-cols-2">
        {TRANSIT_PLANS.map((plan) => {
          const active = chosenKey === plan.key;
          const saving = choosing === plan.key;
          return (
            <button
              key={plan.key}
              type="button"
              disabled={saving}
              aria-pressed={active}
              onClick={() => choosePlan(plan.key, plan.monthlyEur)}
              className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors disabled:opacity-60 ${
                active ? "border-gold bg-gold/10" : "border-line bg-card-2 hover:border-gold/50"
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  active ? "border-gold" : "border-mute/50"
                }`}
              >
                {active && <span className="h-2.5 w-2.5 rounded-full bg-gold" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-medium text-ink">{plan.name}</span>
                  <span className="text-sm font-semibold text-gold-hi">{plan.priceLabel}</span>
                </span>
                <span className="mt-0.5 block text-xs text-ink-2">{plan.covers}</span>
                <span className="mt-1 block text-xs text-mute">
                  {plan.operator}
                  {plan.note && <> · {plan.note}</>}
                  {" · "}
                  <a
                    href={plan.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="underline decoration-mute/40 underline-offset-2 hover:text-info"
                  >
                    site oficial
                  </a>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* preço editável — SudAzur por zonas, avulso por uso, reajustes */}
      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        <Group title="seu passe / mês">
          <NumberField
            label="preço mensal € (edite se o seu caso diferir)"
            name="student_pass_eur"
            initial={passEur}
            patch={patchTransit}
            step="0.5"
            placeholder="15"
          />
          <p className="text-xs text-mute">
            É este número que entra no custo de vida (cenário sem carro). Escolher um plano acima
            preenche automaticamente; aqui você ajusta fino.
          </p>
        </Group>
      </div>
    </div>
  );
}
