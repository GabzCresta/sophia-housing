"use client";

import { useCallback, useEffect, useState } from "react";
import { RouterNotice } from "@/components/router-notice";
import {
  Group,
  Notice,
  NumberField,
  SaveIndicator,
  useAutosave,
} from "@/components/section-ui";
import { eur, eur2, num } from "@/lib/format";
import type { ConfigData, PlaceOption } from "@/lib/types";

/* ── Seção Restaurante (molde do kit section-ui) ─────────────────────────────
   O router lista e mede (cozinha inferida dos types do Google; faixa €; nota;
   refeição estimada pela view v_restaurant_meal_cost). Você: escolhe o seu do
   dia a dia, estipula o budget e vê a gasolina POR SAÍDA até o escolhido. */

const CUISINE_PT: Record<string, string> = {
  francesa: "francesa",
  italiana: "italiana",
  pizza: "pizza",
  kebab: "kebab",
  mediterranea: "mediterrânea",
  gastronomica: "gastronômica",
  outro: "outro",
};

export function RestauranteSection({
  apartmentId,
  places,
  onChanged,
}: {
  apartmentId: string;
  places: PlaceOption[];
  onChanged: () => void;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [cfg, setCfg] = useState<ConfigData["settings"] | null>(null);
  const selected = places.find((p) => p.selected) ?? null;
  const within10 = places.filter((p) => p.walkMin != null && p.walkMin <= 10).length;

  const loadCfg = useCallback(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ConfigData | null) => setCfg(d?.settings ?? null))
      .catch(() => setCfg(null));
  }, []);
  useEffect(loadCfg, [loadCfg]);

  const { patch: patchSettings, state: saveState } = useAutosave(
    "/api/config/settings",
    loadCfg,
    "PUT",
  );

  async function choose(p: PlaceOption) {
    setSavingId(p.id);
    try {
      const res = await fetch(`/api/apartments/${apartmentId}/selection`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "restaurant", place_id: p.selected ? null : p.id }),
      });
      if (res.ok) onChanged();
    } finally {
      setSavingId(null);
    }
  }

  if (places.length === 0) {
    return (
      <RouterNotice
        apartmentId={apartmentId}
        message="nenhum restaurante medido ainda para este endereço"
        onDone={onChanged}
      />
    );
  }

  // Gasolina POR SAÍDA (ida e volta) até o escolhido — €0 se for a pé.
  const fuelPrice = cfg?.fuel_price_eur_per_l ?? null;
  const consumption = cfg?.car_consumption_l_per_100km ?? null;
  const kmRoundTrip = selected?.driveM != null ? (selected.driveM / 1000) * 2 : null;
  const fuelPerOuting =
    kmRoundTrip !== null && fuelPrice !== null && consumption !== null
      ? kmRoundTrip * (consumption / 100) * fuelPrice
      : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-mute">
          O router lista e mede; você escolhe o seu do dia a dia e estipula o budget.
        </p>
        <SaveIndicator state={saveState} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Notice tone="info">
          <span className="font-medium text-ink">Router achou {places.length} restaurantes</span>
          {" · "}
          {within10} a até 10 min a pé · cozinha, faixa de preço e notas do Google
        </Notice>
        {selected ? (
          <Notice tone="ok">
            O seu do dia a dia: <span className="font-medium text-ink">{selected.name}</span> —
            clique nele de novo para desfazer.
          </Notice>
        ) : (
          <Notice tone="todo">
            <span className="font-medium text-ink">Falta você (1):</span> marcar o SEU restaurante
            do dia a dia — ele ancora o custo por saída.
          </Notice>
        )}
      </div>

      {/* budget estipulado + gasolina por saída */}
      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        <Group title="seu budget de restaurantes">
          <NumberField
            label="quanto quero gastar € / mês"
            name="restaurant_budget_eur"
            initial={cfg?.restaurant_budget_eur ?? null}
            patch={patchSettings}
            step="1"
            placeholder="150"
          />
          <p className="text-xs text-mute">
            Sua meta pessoal para saídas — vamos cobrá-la do custo real depois.
          </p>
        </Group>

        <Group title="gasolina por saída">
          {!selected ? (
            <p className="text-xs text-mute">
              Marque o SEU restaurante na lista — a conta usa a distância de carro dele.
            </p>
          ) : selected.driveM == null ? (
            <p className="text-xs text-mute">Sem rota de carro medida para {selected.name}.</p>
          ) : (
            <div>
              <p className="text-xl font-semibold text-ink">
                ≈ {eur2(fuelPerOuting)}{" "}
                <span className="text-sm font-normal text-mute">/ saída (ida e volta)</span>
              </p>
              <p className="mt-1 text-xs text-mute">
                {kmRoundTrip!.toFixed(1).replace(".", ",")} km até {selected.name} ·{" "}
                {consumption ?? "—"} L/100km · €{fuelPrice ?? "—"}/L
                {selected.walkMin != null && (
                  <>
                    {" — "}a pé são {selected.walkMin} min e €0
                  </>
                )}
              </p>
            </div>
          )}
        </Group>
      </div>

      {/* a lista do router, do mais perto ao mais longe */}
      <ul className="mt-4 flex flex-col gap-2">
        {places.map((p) => {
          const saving = savingId === p.id;
          const priceBand = p.price_level ? "€".repeat(p.price_level) : null;
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={saving}
                onClick={() => choose(p)}
                aria-pressed={p.selected}
                className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60 ${
                  p.selected
                    ? "border-gold bg-gold/10"
                    : "border-line bg-card-2 hover:border-gold/50"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    p.selected ? "border-gold" : "border-mute/50"
                  }`}
                >
                  {p.selected && <span className="h-2.5 w-2.5 rounded-full bg-gold" />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{p.name}</span>
                    {priceBand && (
                      <span className="rounded-full border border-line bg-sky px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                        {priceBand}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-mute">
                    {[
                      p.cuisine ? CUISINE_PT[p.cuisine] ?? p.cuisine : null,
                      p.rating != null ? `★ ${String(p.rating).replace(".", ",")}` : null,
                      num(p.meal_cost_eur) !== null ? `refeição ≈ ${eur(p.meal_cost_eur)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>

                <span className="shrink-0 text-right text-sm text-ink-2">
                  <span className="block">
                    {p.walkMin != null ? `${p.walkMin} min a pé` : "a pé —"}
                  </span>
                  <span className="block text-xs text-mute">
                    {p.driveMin != null ? `${p.driveMin} min de carro` : "carro —"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-mute">
        Refeição ≈ estimada pela faixa de preço (€12/€18/€30/€55) até você informar o prato — os
        preços reais entram quando formos ao ponto C da sua lista (custo por saída).
      </p>
    </div>
  );
}
