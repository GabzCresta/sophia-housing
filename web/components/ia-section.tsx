"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Group, INPUT_CLS, Notice } from "@/components/section-ui";
import { eur } from "@/lib/format";
import type { AiSubscription, ConfigData } from "@/lib/types";

/* ── Seção IA — 2 cards (o quê + preço), a pedido do Gabriel. ────────────────
   Cada assinatura somada entra no custo de vida (ai_eur na view). */

export function IaSection({ onChanged }: { onChanged: () => void }) {
  const [subs, setSubs] = useState<AiSubscription[] | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [armedId, setArmedId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ConfigData | null) => setSubs(d?.aiSubscriptions ?? null))
      .catch(() => setSubs(null));
    onChanged();
  }, [onChanged]);
  useEffect(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || price.trim() === "") return;
    setAdding(true);
    try {
      const res = await fetch("/api/config/ai-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), monthly_eur: Number(price) }),
      });
      if (res.ok) {
        setName("");
        setPrice("");
        load();
      }
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/config/ai-subscriptions/${id}`, { method: "DELETE" });
    if (res.ok) load();
    setArmedId(null);
  }

  const total = (subs ?? []).reduce((acc, s) => acc + Number(s.monthly_eur ?? 0), 0);

  return (
    <div>
      <p className="text-sm text-mute">
        Suas assinaturas de IA e ferramentas — a soma entra no custo de vida.
      </p>

      <div className="mt-4">
        {subs && subs.length > 0 ? (
          <Notice tone="ok">
            {subs.length} assinatura{subs.length > 1 ? "s" : ""} ·{" "}
            <span className="font-medium text-ink">{eur(total)}/mês</span> no custo de vida.
          </Notice>
        ) : (
          <Notice tone="todo">
            <span className="font-medium text-ink">Falta você (1):</span> cadastrar suas assinaturas
            (ChatGPT, Claude, hospedagem…).
          </Notice>
        )}
      </div>

      {/* os 2 cards: o quê + preço */}
      <form onSubmit={add} className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        <Group title="o quê">
          <label className="block">
            <span className="microlabel text-mute">nome da assinatura</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Claude Max, ChatGPT Plus…"
              required
              minLength={2}
              className={`mt-1 ${INPUT_CLS}`}
            />
          </label>
        </Group>
        <Group title="preço">
          <label className="block">
            <span className="microlabel text-mute">€ / mês</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="20"
              required
              className={`mt-1 ${INPUT_CLS}`}
            />
          </label>
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-sky transition-colors hover:bg-gold-hi disabled:opacity-60"
          >
            {adding ? "Adicionando…" : "Adicionar"}
          </button>
        </Group>
      </form>

      {/* as assinaturas */}
      <ul className="mt-4 flex flex-col gap-2">
        {(subs ?? []).map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-4 rounded-xl border border-line bg-card-2 px-4 py-3"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{s.name}</span>
            <span className="shrink-0 text-sm text-ink-2">{eur(s.monthly_eur)}/mês</span>
            <button
              type="button"
              aria-label={armedId === s.id ? `confirmar exclusão de ${s.name}` : `apagar ${s.name}`}
              onClick={() => (armedId === s.id ? void remove(s.id) : setArmedId(s.id))}
              onBlur={() => setArmedId(null)}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                armedId === s.id ? "bg-bad/15 text-bad" : "text-mute hover:bg-bad/10 hover:text-bad"
              }`}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              {armedId === s.id && "apagar?"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
