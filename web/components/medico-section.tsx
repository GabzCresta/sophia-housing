"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { RouterNotice } from "@/components/router-notice";
import {
  Group,
  Notice,
  NumberField,
  SaveIndicator,
  useAutosave,
} from "@/components/section-ui";
import { googleMapsUrl } from "@/lib/cabeleireiro";
import { eur2, num } from "@/lib/format";
import type { ConfigData, PlaceOption } from "@/lib/types";

/* ── Seção Médico — hospitais + farmácias, gasolina POR IDA na linha, budget. ─
   Sem escolha de "o meu": saúde não tem frequência previsível; o custo de
   carro aparece por lugar (ida e volta) para você saber o que uma ida custa. */

export function MedicoSection({
  apartmentId,
  hospitals,
  pharmacies,
  onChanged,
}: {
  apartmentId: string;
  hospitals: PlaceOption[];
  pharmacies: PlaceOption[];
  onChanged: () => void;
}) {
  const [cfg, setCfg] = useState<ConfigData["settings"] | null>(null);

  const loadCfg = useCallback(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ConfigData | null) => setCfg(d?.settings ?? null))
      .catch(() => setCfg(null));
    onChanged();
  }, [onChanged]);
  useEffect(loadCfg, [loadCfg]);

  const { patch: patchSettings, state: saveState } = useAutosave(
    "/api/config/settings",
    loadCfg,
    "PUT",
  );

  const all = [
    ...hospitals.map((p) => ({ ...p, kind: "hospital" as const })),
    ...pharmacies.map((p) => ({ ...p, kind: "farmácia" as const })),
  ].sort((a, b) => (a.walkMin ?? 999) - (b.walkMin ?? 999));

  if (all.length === 0) {
    return (
      <RouterNotice
        apartmentId={apartmentId}
        message="nenhum hospital/farmácia medido ainda para este endereço"
        onDone={onChanged}
      />
    );
  }

  const budget = cfg?.health_budget_eur ?? null;
  const fuelPrice = cfg?.fuel_price_eur_per_l ?? null;
  const consumption = cfg?.car_consumption_l_per_100km ?? null;

  // Gasolina de UMA ida e volta até o lugar — visível linha a linha.
  const fuelRoundTrip = (p: PlaceOption): number | null => {
    if (p.driveM == null || fuelPrice === null || consumption === null) return null;
    return ((p.driveM / 1000) * 2 * (consumption / 100)) * fuelPrice;
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-mute">
          Hospitais e farmácias ao redor — cada linha mostra o que UMA ida de carro custa.
        </p>
        <SaveIndicator state={saveState} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Notice tone="info">
          <span className="font-medium text-ink">
            Router achou {hospitals.length} hospitais e {pharmacies.length} farmácias
          </span>{" "}
          · tempos, notas e gasolina por ida (ida e volta, {consumption ?? "—"} L/100km · €
          {fuelPrice ?? "—"}/L)
        </Notice>
        {budget != null ? (
          <Notice tone="ok">
            Budget de saúde:{" "}
            <span className="font-medium text-ink">€{String(budget).replace(".", ",")}/mês</span>.
          </Notice>
        ) : (
          <Notice tone="todo">
            <span className="font-medium text-ink">Falta você (1):</span> estipular o budget de
            saúde do mês (mutuelle, consultas, remédios).
          </Notice>
        )}
      </div>

      {/* budget */}
      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        <Group title="seu budget de saúde">
          <NumberField
            label="quanto quero gastar € / mês"
            name="health_budget_eur"
            initial={budget}
            patch={patchSettings}
            step="1"
            placeholder="40"
          />
          <p className="text-xs text-mute">
            Mutuelle estudantil, consultas e farmácia — sua meta pessoal.
          </p>
        </Group>
      </div>

      {/* hospitais + farmácias, do mais perto ao mais longe */}
      <ul className="mt-4 flex flex-col gap-2">
        {all.map((p) => {
          const url = googleMapsUrl(p);
          const fuel = fuelRoundTrip(p);
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-card-2 px-4 py-3"
            >
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                  p.kind === "hospital"
                    ? "border-bad/40 bg-bad/10 text-bad"
                    : "border-good/40 bg-good/10 text-good"
                }`}
              >
                {p.kind}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{p.name}</span>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      title="ver no Google Maps"
                      className="inline-flex items-center gap-1 text-xs text-info underline decoration-info/40 underline-offset-2 transition-colors hover:text-gold-hi"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                      ver no Google
                    </a>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-mute">
                  {[
                    p.rating != null ? `★ ${String(p.rating).replace(".", ",")}` : null,
                    num(fuel) !== null ? `gasolina por ida: ≈ ${eur2(fuel)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </span>

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
