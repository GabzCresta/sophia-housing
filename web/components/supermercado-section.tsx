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
import { eur2, num } from "@/lib/format";
import type { ConfigData, PlaceOption } from "@/lib/types";

/* ── Seção Supermercado (molde do kit section-ui) ────────────────────────────
   A lista inteira vem do router; sua tarefa: marcar "este é o meu". Entre os
   avisos e a lista: o budget que VOCÊ estipula e a gasolina até o SEU mercado
   (idas/mês você preenche; distância vem do router; preço/consumo das settings). */

const MARKET_TYPE_PT: Record<string, string> = {
  hipermercado: "hipermercado",
  supermercado: "supermercado",
  mercearia: "mercearia",
  discount: "discount",
  congelados: "congelados",
  bio: "bio",
};

function fmtIdx(v: number | null | undefined) {
  const n = num(v);
  return n === null ? null : n.toFixed(2).replace(".", ",");
}

export function SupermercadoSection({
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
  const discounts = places.filter((p) => p.is_discount).length;

  // Config global (budget, idas/mês, preço do litro, consumo) — não afeta o
  // pontinho do mini-card, então a própria seção é dona deste fetch.
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
        // clicar no já escolhido limpa a escolha
        body: JSON.stringify({ category: "supermarket", place_id: p.selected ? null : p.id }),
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
        message="nenhum supermercado medido ainda para este endereço"
        onDone={onChanged}
      />
    );
  }

  // Gasolina/mês até o SEU mercado: ida e volta × idas × consumo × preço.
  const trips = cfg?.supermarket_trips_per_month ?? null;
  const fuelPrice = cfg?.fuel_price_eur_per_l ?? null;
  const consumption = cfg?.car_consumption_l_per_100km ?? null;
  const kmRoundTrip = selected?.driveM != null ? (selected.driveM / 1000) * 2 : null;
  const fuelMonthly =
    kmRoundTrip !== null && trips !== null && fuelPrice !== null && consumption !== null
      ? kmRoundTrip * trips * (consumption / 100) * fuelPrice
      : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-mute">
          O router lista e mede; você escolhe o seu mercado e estipula o budget.
        </p>
        <SaveIndicator state={saveState} />
      </div>

      {/* origem + o que falta de você */}
      <div className="mt-4 flex flex-col gap-2">
        <Notice tone="info">
          <span className="font-medium text-ink">Router achou {places.length} mercados</span>
          {" · "}
          {discounts > 0 ? `${discounts} discount` : "nenhum discount no raio"} · tempos e notas do
          Google
        </Notice>
        {selected ? (
          <Notice tone="ok">
            O seu mercado: <span className="font-medium text-ink">{selected.name}</span> — clique
            nele de novo para desfazer.
          </Notice>
        ) : (
          <Notice tone="todo">
            <span className="font-medium text-ink">Falta você (1):</span> marcar o SEU mercado — é
            ele que vai definir o custo de comida.
          </Notice>
        )}
      </div>

      {/* budget estipulado + gasolina até o mercado — os dois são seus */}
      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        <Group title="seu budget de mercado">
          <NumberField
            label="quanto quero gastar € / mês"
            name="supermarket_budget_eur"
            initial={cfg?.supermarket_budget_eur ?? null}
            patch={patchSettings}
            step="1"
            placeholder="400"
          />
          <p className="text-xs text-mute">
            Sua meta pessoal — vale para qualquer residência; vamos cobrá-la do custo real depois.
          </p>
        </Group>

        <Group title="gasolina até o mercado">
          <NumberField
            label="idas ao mercado / mês"
            name="supermarket_trips_per_month"
            initial={cfg?.supermarket_trips_per_month ?? null}
            patch={patchSettings}
            step="1"
            placeholder="4"
          />
          {!selected ? (
            <p className="text-xs text-mute">
              Marque o SEU mercado na lista — a conta usa a distância de carro dele.
            </p>
          ) : selected.driveM == null ? (
            <p className="text-xs text-mute">Sem rota de carro medida para {selected.name}.</p>
          ) : trips === null ? (
            <p className="text-xs text-mute">Diga as idas/mês para eu fechar a conta.</p>
          ) : (
            <div>
              <p className="text-xl font-semibold text-ink">
                ≈ {eur2(fuelMonthly)} <span className="text-sm font-normal text-mute">/ mês</span>
              </p>
              <p className="mt-1 text-xs text-mute">
                {kmRoundTrip!.toFixed(1).replace(".", ",")} km ida e volta até {selected.name} ×{" "}
                {trips} idas · {consumption ?? "—"} L/100km · €{fuelPrice ?? "—"}/L
              </p>
            </div>
          )}
        </Group>
      </div>

      {/* a lista do router, do mais perto ao mais longe */}
      <ul className="mt-4 flex flex-col gap-2">
        {places.map((p) => {
          const idx = fmtIdx(p.price_index);
          const saving = savingId === p.id;
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
                {/* radio "este é o meu" */}
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
                    {p.is_discount && (
                      <span className="rounded-full border border-good/40 bg-good/10 px-2 py-0.5 text-[11px] font-semibold text-good">
                        discount
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-mute">
                    {[
                      p.market_type ? MARKET_TYPE_PT[p.market_type] ?? p.market_type : null,
                      p.rating != null ? `★ ${String(p.rating).replace(".", ",")}` : null,
                      idx ? `índice de preço ${idx}` : null,
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
        Índice de preço: 1,00 = referência da região; 0,82 = ~18% mais barato. Vem da rede
        (config/chains.json), não do Google.
      </p>
    </div>
  );
}
