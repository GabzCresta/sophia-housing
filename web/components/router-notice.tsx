"use client";

import { useState } from "react";

/** Aviso azul "vez do router" + botão que dispara o cálculo (human-in-the-loop:
 *  bate na Google API, então só roda no clique). Compartilhado pelas seções. */
export function RouterNotice({
  apartmentId,
  message,
  onDone,
}: {
  apartmentId: string;
  message: string;
  onDone: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run() {
    setRunning(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/apartments/${apartmentId}/recalc-routes`, { method: "POST" });
      if (!res.ok) throw new Error();
      onDone();
    } catch {
      setFailed(true);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-info/30 bg-info/5 px-4 py-2.5 text-sm">
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-info" />
        <span className="text-ink-2">
          <span className="font-medium text-ink">Router:</span> {message}
        </span>
      </span>
      <button
        type="button"
        disabled={running}
        onClick={run}
        className="rounded-lg border border-info/40 bg-info/10 px-3 py-1.5 text-xs font-semibold text-info transition-colors hover:bg-info/20 disabled:opacity-60"
      >
        {running ? "calculando… (pode levar minutos)" : "Calcular distâncias"}
      </button>
      {failed && <span className="text-xs text-bad">o router falhou — veja o terminal</span>}
    </div>
  );
}
