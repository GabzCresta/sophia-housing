"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Group,
  Notice,
  NumberField,
  SaveIndicator,
  useAutosave,
} from "@/components/section-ui";
import type { ConfigData } from "@/lib/types";

/* ── Seção Viajar — só o budget, a pedido do Gabriel ("e nada mais"). ─────── */

export function ViajarSection({ onChanged }: { onChanged: () => void }) {
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

  const budget = cfg?.travel_budget_eur ?? null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-mute">Quanto do mês vai para conhecer a Côte d&apos;Azur.</p>
        <SaveIndicator state={saveState} />
      </div>

      <div className="mt-4">
        {budget != null ? (
          <Notice tone="ok">
            Budget de viagens: <span className="font-medium text-ink">€{String(budget).replace(".", ",")}/mês</span>.
          </Notice>
        ) : (
          <Notice tone="todo">
            <span className="font-medium text-ink">Falta você (1):</span> estipular o budget de
            viagens do mês.
          </Notice>
        )}
      </div>

      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        <Group title="seu budget de viagens">
          <NumberField
            label="quanto quero gastar € / mês"
            name="travel_budget_eur"
            initial={budget}
            patch={patchSettings}
            step="1"
            placeholder="200"
          />
          <p className="text-xs text-mute">
            Sua meta pessoal — trens e bate-voltas já são cobertos pelo PASS ZOU! Études.
          </p>
        </Group>
      </div>
    </div>
  );
}
