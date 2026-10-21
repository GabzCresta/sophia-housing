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

/* ── Seção Cabeleireiro (padrão do supermercado) ─────────────────────────────
   O router lista e mede (hair_salon + barber_shop); cada linha tem nota do
   Google e link para conferir o lugar no Maps. Budget seu à parte. */

export function CabeleireiroSection({
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
        body: JSON.stringify({ category: "hair_salon", place_id: p.selected ? null : p.id }),
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
        message="nenhum cabeleireiro medido ainda para este endereço"
        onDone={onChanged}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-mute">
          O router lista e mede; confira o lugar no link do Google antes de escolher o seu.
        </p>
        <SaveIndicator state={saveState} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Notice tone="info">
          <span className="font-medium text-ink">
            Router achou {places.length} cabeleireiros/barbearias
          </span>
          {" · "}
          {within10} a até 10 min a pé · notas do Google
        </Notice>
        {selected ? (
          <Notice tone="ok">
            O seu: <span className="font-medium text-ink">{selected.name}</span> — clique nele de
            novo para desfazer.
          </Notice>
        ) : (
          <Notice tone="todo">
            <span className="font-medium text-ink">Falta você (1):</span> marcar o SEU cabeleireiro.
          </Notice>
        )}
      </div>

      {/* budget */}
      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        <Group title="seu budget de cabeleireiro">
          <NumberField
            label="quanto quero gastar € / mês"
            name="hair_budget_eur"
            initial={cfg?.hair_budget_eur ?? null}
            patch={patchSettings}
            step="1"
            placeholder="25"
          />
          <p className="text-xs text-mute">
            Sua meta pessoal (ex.: um corte de ~€25/mês) — vamos cobrá-la do custo real depois.
          </p>
        </Group>
      </div>

      {/* a lista, do mais perto ao mais longe */}
      <ul className="mt-4 flex flex-col gap-2">
        {places.map((p) => {
          const saving = savingId === p.id;
          const url = googleMapsUrl(p);
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
                title="este é o meu"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 disabled:opacity-60 ${
                  p.selected ? "border-gold" : "border-mute/50 hover:border-gold/60"
                }`}
              >
                {p.selected && <span className="h-2.5 w-2.5 rounded-full bg-gold" />}
              </button>

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
