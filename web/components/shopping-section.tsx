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
import type { ConfigData, PlaceOption } from "@/lib/types";

/* ── Seção Shopping — só a lista do router + budget (pedido dele). ────────── */

export function ShoppingSection({
  apartmentId,
  places,
  onChanged,
}: {
  apartmentId: string;
  places: PlaceOption[];
  onChanged: () => void;
}) {
  const [cfg, setCfg] = useState<ConfigData["settings"] | null>(null);

  const loadCfg = useCallback(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ConfigData | null) => setCfg(d?.settings ?? null))
      .catch(() => setCfg(null));
    onChanged(); // o dot do mini-card lê o config do quadro
  }, [onChanged]);
  useEffect(loadCfg, [loadCfg]);

  const { patch: patchSettings, state: saveState } = useAutosave(
    "/api/config/settings",
    loadCfg,
    "PUT",
  );

  if (places.length === 0) {
    return (
      <RouterNotice
        apartmentId={apartmentId}
        message="nenhum shopping medido ainda para este endereço"
        onDone={onChanged}
      />
    );
  }

  const budget = cfg?.shopping_budget_eur ?? null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-mute">Os shoppings ao redor e o quanto do mês vai para compras.</p>
        <SaveIndicator state={saveState} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Notice tone="info">
          <span className="font-medium text-ink">Router achou {places.length} shoppings</span> ·
          tempos e notas do Google
        </Notice>
        {budget != null ? (
          <Notice tone="ok">
            Budget de compras:{" "}
            <span className="font-medium text-ink">€{String(budget).replace(".", ",")}/mês</span>.
          </Notice>
        ) : (
          <Notice tone="todo">
            <span className="font-medium text-ink">Falta você (1):</span> estipular o budget de
            compras do mês.
          </Notice>
        )}
      </div>

      {/* budget */}
      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        <Group title="seu budget de compras">
          <NumberField
            label="quanto quero gastar € / mês"
            name="shopping_budget_eur"
            initial={budget}
            patch={patchSettings}
            step="1"
            placeholder="100"
          />
          <p className="text-xs text-mute">Roupas, casa, presentes — sua meta pessoal.</p>
        </Group>
      </div>

      {/* a lista, do mais perto ao mais longe */}
      <ul className="mt-4 flex flex-col gap-2">
        {places.map((p) => {
          const url = googleMapsUrl(p);
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-card-2 px-4 py-3"
            >
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
                  {p.rating != null ? `★ ${String(p.rating).replace(".", ",")}` : "sem nota"}
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
