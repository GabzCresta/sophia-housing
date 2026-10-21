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
import { eur2 } from "@/lib/format";
import type { ConfigData, PlaceOption } from "@/lib/types";

/* ── Seção Igreja (molde do kit) ─────────────────────────────────────────────
   O router lista e mede; "missa em inglês" é informação SUA (vai descobrindo
   e marcando no chip: ? → sim → não). A escolhida ancora a gasolina/mês. */

export function IgrejaSection({
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
  const withEnglish = places.filter((p) => p.has_english_mass === true).length;

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
        body: JSON.stringify({ category: "church", place_id: p.selected ? null : p.id }),
      });
      if (res.ok) onChanged();
    } finally {
      setSavingId(null);
    }
  }

  // Chip cíclico "missa EN": ? → sim → não → ?
  async function cycleEnglish(p: PlaceOption) {
    const next = p.has_english_mass === null || p.has_english_mass === undefined
      ? true
      : p.has_english_mass
        ? false
        : null;
    const res = await fetch(`/api/places/${p.id}/church`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ has_english_mass: next }),
    });
    if (res.ok) onChanged();
  }

  if (places.length === 0) {
    return (
      <RouterNotice
        apartmentId={apartmentId}
        message="nenhuma igreja medida ainda para este endereço"
        onDone={onChanged}
      />
    );
  }

  const trips = cfg?.church_trips_per_month ?? null;
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
          O router lista e mede; missa em inglês você marca no chip conforme descobre.
        </p>
        <SaveIndicator state={saveState} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Notice tone="info">
          <span className="font-medium text-ink">Router achou {places.length} igrejas</span>
          {" · "}
          {within10} a até 10 min a pé
          {withEnglish > 0 && <> · {withEnglish} com missa em inglês confirmada</>}
          {cfg?.mass_availability_window && <> · sua janela: {cfg.mass_availability_window}</>}
        </Notice>
        {selected ? (
          <Notice tone="ok">
            A sua igreja: <span className="font-medium text-ink">{selected.name}</span>
            {selected.has_english_mass === true && <> · missa EN ✓</>} — clique nela de novo para
            desfazer.
          </Notice>
        ) : (
          <Notice tone="todo">
            <span className="font-medium text-ink">Falta você (1):</span> marcar a SUA igreja — ela
            ancora a gasolina do mês.
          </Notice>
        )}
      </div>

      {/* gasolina até a igreja */}
      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        <Group title="gasolina até a igreja">
          <NumberField
            label="missas / mês"
            name="church_trips_per_month"
            initial={cfg?.church_trips_per_month ?? null}
            patch={patchSettings}
            step="1"
            placeholder="4"
          />
          {!selected ? (
            <p className="text-xs text-mute">
              Marque a SUA igreja na lista — a conta usa a distância de carro dela.
            </p>
          ) : selected.driveM == null ? (
            <p className="text-xs text-mute">Sem rota de carro medida para {selected.name}.</p>
          ) : trips === null ? (
            <p className="text-xs text-mute">Diga as missas/mês para eu fechar a conta.</p>
          ) : (
            <div>
              <p className="text-xl font-semibold text-ink">
                ≈ {eur2(fuelMonthly)} <span className="text-sm font-normal text-mute">/ mês</span>
              </p>
              <p className="mt-1 text-xs text-mute">
                {kmRoundTrip!.toFixed(1).replace(".", ",")} km ida e volta até {selected.name} ×{" "}
                {trips} missas · {consumption ?? "—"} L/100km · €{fuelPrice ?? "—"}/L
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

      {/* a lista, do mais perto ao mais longe */}
      <ul className="mt-4 flex flex-col gap-2">
        {places.map((p) => {
          const saving = savingId === p.id;
          const en = p.has_english_mass;
          return (
            <li
              key={p.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 transition-colors ${
                p.selected ? "border-gold bg-gold/10" : "border-line bg-card-2"
              }`}
            >
              <button
                type="button"
                disabled={saving}
                onClick={() => void choose(p)}
                aria-pressed={p.selected}
                title="esta é a minha"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 disabled:opacity-60 ${
                  p.selected ? "border-gold" : "border-mute/50 hover:border-gold/60"
                }`}
              >
                {p.selected && <span className="h-2.5 w-2.5 rounded-full bg-gold" />}
              </button>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                <span className="mt-0.5 block text-xs text-mute">
                  {[
                    p.rating != null ? `★ ${String(p.rating).replace(".", ",")}` : null,
                    p.mass_times_sunday ? `missas dom: ${p.mass_times_sunday}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </span>

              {/* chip cíclico: missa em inglês? (dado seu) */}
              <button
                type="button"
                onClick={() => void cycleEnglish(p)}
                title="você marca conforme descobre: ? → sim → não"
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  en === true
                    ? "border-good/40 bg-good/10 text-good"
                    : en === false
                      ? "border-line bg-sky text-mute line-through"
                      : "border-line bg-sky text-ink-2 hover:border-gold/50"
                }`}
              >
                {en === true ? "missa EN ✓" : en === false ? "missa EN" : "missa EN ?"}
              </button>

              <span className="w-28 shrink-0 text-right text-sm text-ink-2">
                <span className="block">{p.walkMin != null ? `${p.walkMin} min a pé` : "a pé —"}</span>
                <span className="block text-xs text-mute">
                  {p.driveMin != null ? `${p.driveMin} min de carro` : "carro —"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
