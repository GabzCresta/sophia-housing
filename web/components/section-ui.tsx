"use client";

import { useCallback, useState } from "react";
import { num } from "@/lib/format";

/* ── O kit de UI das seções — "UI Moradia", aprovado pelo Gabriel (2026-07-11) ──
   TODA seção do quadro replica esta anatomia:
   1. Linha de contexto + <SaveIndicator/> ("salvo ✓") no topo;
   2. Avisos AGREGADOS logo abaixo (<Notice/> âmbar "falta você" / verde ok /
      azul info; RouterNotice para cálculo pendente) — nunca alarme campo-a-campo;
   3. <AutoTile/> dourado para valores calculados (views) — ninguém digita;
   4. <Group/> (box com legenda dourada) por ponto; campos limpos (border-line);
   5. Autosave no blur/change via useAutosave(); badge "router" só onde o router
      escreve; inputs re-sincronizam quando o valor do SERVIDOR muda (key). */

export type Patch = (payload: Record<string, unknown>) => Promise<boolean>;
export type SaveState = "idle" | "saving" | "saved" | "error";

export const INPUT_CLS =
  "w-full rounded-lg border border-line bg-sky px-3 py-2 text-sm text-ink placeholder:text-mute/60 outline-none transition-colors focus:border-gold";

/** PATCH parcial com estado de gravação — o autosave de toda seção. */
export function useAutosave(url: string, onSaved: () => void, method: "PATCH" | "PUT" = "PATCH") {
  const [state, setState] = useState<SaveState>("idle");
  const patch = useCallback<Patch>(
    async (payload) => {
      setState("saving");
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        setState("saved");
        onSaved(); // o dono dos dados recarrega → tiles/avisos atualizam
        return true;
      } catch {
        setState("error");
        return false;
      }
    },
    [url, onSaved, method],
  );
  return { patch, state };
}

export function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span
      className={`microlabel ${
        state === "error" ? "text-bad" : state === "saving" ? "text-mute" : "text-gold-hi"
      }`}
    >
      {state === "saving" ? "gravando…" : state === "saved" ? "salvo ✓" : state === "error" ? "erro ao salvar" : ""}
    </span>
  );
}

/** Aviso agregado do topo da seção: âmbar = falta você · verde = ok · azul = info. */
export function Notice({
  tone,
  children,
}: {
  tone: "todo" | "ok" | "info";
  children: React.ReactNode;
}) {
  const cls = {
    todo: { box: "border-warn/30 bg-warn/5", dot: "bg-warn" },
    ok: { box: "border-good/30 bg-good/5", dot: "bg-good" },
    info: { box: "border-info/30 bg-info/5", dot: "bg-info" },
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-2.5 text-sm ${cls.box}`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cls.dot}`} />
      <p className="text-ink-2">{children}</p>
    </div>
  );
}

/* ── grupos e tiles ── */

/** Box de um ponto da seção (A · identificação, B · custo…). */
export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-line bg-card-2/40 p-4">
      <legend className="microlabel px-1 text-gold-hi">{title}</legend>
      <div className="flex flex-col gap-3.5">{children}</div>
    </fieldset>
  );
}

/** Valor calculado pela view (ninguém digita) — tile dourado. */
export function AutoTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
      <p className="microlabel text-gold-hi">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-mute">{hint}</p>}
    </div>
  );
}

/* ── campos (autosave no blur/change; key = re-sincroniza com o servidor) ── */

export function Field({
  label,
  source,
  children,
}: {
  label: string;
  source?: "router";
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5">
        <span className="microlabel text-mute">{label}</span>
        {source === "router" && (
          <span className="microlabel text-info" title="o router preenche; você pode corrigir">
            router
          </span>
        )}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function TextField({
  label,
  name,
  initial,
  patch,
  placeholder,
  rows,
  source,
  routerDone,
}: {
  label: string;
  name: string;
  initial: string | null;
  patch: Patch;
  placeholder?: string;
  rows?: number;
  source?: "router";
  routerDone?: boolean;
}) {
  const empty = initial === null || initial.trim() === "";
  const commit = (v: string) => {
    const val = v.trim() === "" ? null : v.trim();
    if (val !== (initial ?? null)) void patch({ [name]: val });
  };
  return (
    <Field label={label} source={source}>
      {rows ? (
        <textarea
          key={initial ?? "∅"}
          defaultValue={initial ?? ""}
          rows={rows}
          placeholder={placeholder}
          onBlur={(e) => commit(e.target.value)}
          className={`${INPUT_CLS} resize-y`}
        />
      ) : (
        <input
          key={initial ?? "∅"}
          defaultValue={initial ?? ""}
          placeholder={
            source === "router" && empty
              ? routerDone
                ? "router não achou — preencha se souber"
                : "o router preenche"
              : placeholder
          }
          onBlur={(e) => commit(e.target.value)}
          className={INPUT_CLS}
        />
      )}
    </Field>
  );
}

export function NumberField({
  label,
  name,
  initial,
  patch,
  step = "0.01",
  placeholder,
}: {
  label: string;
  name: string;
  initial: number | null;
  patch: Patch;
  step?: string;
  placeholder?: string;
}) {
  const commit = (v: string) => {
    const val = v.trim() === "" ? null : Number(v);
    if (val !== null && !Number.isFinite(val)) return;
    if (val !== num(initial)) void patch({ [name]: val });
  };
  return (
    <Field label={label}>
      <input
        key={num(initial) ?? "∅"}
        type="number"
        step={step}
        defaultValue={num(initial) ?? ""}
        placeholder={placeholder}
        onBlur={(e) => commit(e.target.value)}
        className={INPUT_CLS}
      />
    </Field>
  );
}

export function SelectField({
  label,
  name,
  initial,
  options,
  patch,
  allowNull = true,
}: {
  label: string;
  name: string;
  initial: string | null;
  options: readonly (readonly [string, string])[];
  patch: Patch;
  allowNull?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        key={initial ?? "∅"}
        defaultValue={initial ?? ""}
        onChange={(e) => void patch({ [name]: e.target.value === "" ? null : e.target.value })}
        className={INPUT_CLS}
      >
        {allowNull && <option value="">—</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function BoolField({
  label,
  name,
  initial,
  patch,
}: {
  label: string;
  name: string;
  initial: boolean | null;
  patch: Patch;
}) {
  return (
    <Field label={label}>
      <select
        key={initial === null ? "∅" : String(initial)}
        defaultValue={initial === null ? "" : String(initial)}
        onChange={(e) =>
          void patch({ [name]: e.target.value === "" ? null : e.target.value === "true" })
        }
        className={INPUT_CLS}
      >
        <option value="">—</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    </Field>
  );
}

export function RatingField({
  label,
  name,
  initial,
  patch,
}: {
  label: string;
  name: string;
  initial: number | null;
  patch: Patch;
}) {
  const val = num(initial);
  const set = (n: number) => void patch({ [name]: val === n ? null : n });
  return (
    <Field label={label}>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={val === n}
            onClick={() => set(n)}
            className={`h-8 w-8 rounded-lg border text-sm font-medium transition-colors ${
              val !== null && n <= val
                ? "border-gold bg-gold/15 text-gold-hi"
                : "border-line bg-sky text-mute hover:border-gold/50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function ChipsField({
  label,
  name,
  initial,
  options,
  patch,
}: {
  label: string;
  name: string;
  initial: string[] | null;
  options: readonly (readonly [string, string])[];
  patch: Patch;
}) {
  const vals = initial ?? [];
  const toggle = (v: string) => {
    const next = vals.includes(v) ? vals.filter((x) => x !== v) : [...vals, v];
    void patch({ [name]: next.length ? next : null });
  };
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, l]) => {
          const on = vals.includes(v);
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(v)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                on
                  ? "border-gold bg-gold/15 text-gold-hi"
                  : "border-line bg-sky text-ink-2 hover:border-gold/50"
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function DateField({
  label,
  name,
  initial,
  patch,
}: {
  label: string;
  name: string;
  initial: string | null;
  patch: Patch;
}) {
  return (
    <Field label={label}>
      <input
        key={initial ?? "∅"}
        type="date"
        defaultValue={initial ? initial.slice(0, 10) : ""}
        onChange={(e) => void patch({ [name]: e.target.value === "" ? null : e.target.value })}
        className={INPUT_CLS}
      />
    </Field>
  );
}
