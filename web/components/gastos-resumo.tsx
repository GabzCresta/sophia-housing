"use client";

import { useCallback, useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { eur } from "@/lib/format";

/* ── O preço desta vida — pie chart dos gastos preenchidos nas 12 seções. ────
   Dados da rota /gastos (servidor soma tudo, inclusive a gasolina inteligente:
   campus × dias de aula + mercado/academia/igreja escolhidos × frequência).
   Fatias só do que tem valor; a legenda lista TUDO (— = falta preencher), com
   os valores em texto — a identidade nunca depende só da cor. */

interface GastoSlice {
  key: string;
  label: string;
  value: number | null;
}

const SLICE_COLOR: Record<string, string> = {
  moradia: "#c98500", // o sol
  supermercado: "#1baf7a",
  restaurante: "#d95926",
  transporte: "#4f8fe0",
  carro: "#e66767",
  gasolina: "#fab219",
  academia: "#6a58d6",
  viagem: "#6da7ec",
  ia: "#b53563",
  cabeleireiro: "#e87ba4",
  shopping: "#008300",
  medico: "#9085e9",
};

export function GastosResumo({ apartmentId }: { apartmentId: string }) {
  const [data, setData] = useState<{ total: number; slices: GastoSlice[] } | null>(null);

  const load = useCallback(() => {
    fetch(`/api/apartments/${apartmentId}/gastos`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, [apartmentId]);

  useEffect(() => {
    load();
    // Recarrega quando qualquer seção grava algo (o LifeBoard dispara) ou no focus.
    window.addEventListener("sophia:changed", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("sophia:changed", load);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  if (!data) {
    return (
      <section className="w-full rounded-2xl border border-line bg-card p-6">
        <p className="microlabel text-gold-hi">o preço desta vida</p>
        <p className="mt-3 text-sm text-mute">Somando os gastos…</p>
      </section>
    );
  }

  const filled = data.slices.filter((s) => (s.value ?? 0) > 0);
  const missing = data.slices.filter((s) => s.value === null).length;
  const chartData = filled
    .slice()
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .map((s) => ({ name: s.label, value: s.value ?? 0, key: s.key }));

  return (
    <section className="w-full rounded-2xl border border-line bg-card p-6">
      <p className="microlabel text-gold-hi">o preço desta vida</p>
      <p className="mt-1 text-sm text-mute">
        Tudo que você preencheu nas 12 seções, somado por mês
        {missing > 0 && <> — {missing} ainda sem valor</>}.
      </p>

      <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
        {/* o pie (donut com o total no centro) */}
        <div className="relative h-64 w-64 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={72}
                outerRadius={104}
                startAngle={90}
                endAngle={-270}
                stroke="#0a1322"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {chartData.map((d) => (
                  <Cell key={d.key} fill={SLICE_COLOR[d.key] ?? "#6c7d9e"} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-lg border border-line bg-card-2 px-3 py-1.5 text-sm text-ink shadow-lg">
                      {payload[0].name}:{" "}
                      <span className="font-semibold">{eur(payload[0].value)}</span>
                    </div>
                  ) : null
                }
              />
            </PieChart>
          </ResponsiveContainer>
          {/* total no centro */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-ink">{eur(data.total)}</span>
            <span className="microlabel text-mute">/ mês</span>
          </div>
        </div>

        {/* legenda com valores — identidade nunca só pela cor */}
        <ul className="grid w-full grid-cols-1 gap-x-6 gap-y-1.5 md:grid-cols-2">
          {data.slices.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  background: (s.value ?? 0) > 0 ? SLICE_COLOR[s.key] : "transparent",
                  border: (s.value ?? 0) > 0 ? "none" : "1.5px solid #6c7d9e",
                }}
              />
              <span className={(s.value ?? 0) > 0 ? "text-ink-2" : "text-mute"}>{s.label}</span>
              <span
                className={`ml-auto tabular-nums ${
                  (s.value ?? 0) > 0 ? "font-medium text-ink" : "text-mute"
                }`}
              >
                {s.value !== null ? eur(s.value) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
