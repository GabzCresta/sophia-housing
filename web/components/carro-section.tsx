"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Group,
  INPUT_CLS,
  Notice,
  NumberField,
  SaveIndicator,
  useAutosave,
} from "@/components/section-ui";
import { carFixedMonthly, SCENARIO_PT } from "@/lib/carro";
import { eur, eur2, num } from "@/lib/format";
import type { ApartmentOverview, CarConfigRow, ConfigData } from "@/lib/types";

/* ── Seção Carro (molde do kit) ──────────────────────────────────────────────
   Você cadastra carros de qualquer site (cargo-flex, Sixt…) com a ficha de
   custo completa; os [auto]: amortização de compra, combustível por residência
   (campus × dias de aula, das views) e o custo total/mês. O escolhido vive em
   settings.active_car_id; "com carro × sem carro" é o cenário ativo. */

const EMPTY_FORM = {
  source: "",
  model: "",
  scenario: "leasing",
  km_included: "",
  monthly_eur: "",
  purchase_price_eur: "",
  resale_estimate_eur: "",
  months: "",
  insurance_eur: "",
  insurance_deductible_eur: "",
  tolls_eur: "",
  home_parking_eur: "",
  maintenance_eur: "",
};

export function CarroSection({
  apartmentId,
  onChanged,
}: {
  apartmentId: string;
  onChanged: () => void;
}) {
  const [cfg, setCfg] = useState<ConfigData | null>(null);
  const [overview, setOverview] = useState<ApartmentOverview | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCfg(d))
      .catch(() => setCfg(null));
    fetch(`/api/apartments/${apartmentId}/overview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setOverview(d))
      .catch(() => setOverview(null));
    onChanged();
  }, [apartmentId, onChanged]);

  useEffect(() => {
    fetch("/api/config").then((r) => (r.ok ? r.json() : null)).then(setCfg).catch(() => setCfg(null));
    fetch(`/api/apartments/${apartmentId}/overview`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setOverview)
      .catch(() => setOverview(null));
  }, [apartmentId]);

  const { patch: patchSettings, state: saveState } = useAutosave("/api/config/settings", load, "PUT");

  const cars = cfg?.cars ?? [];
  const activeId = cfg?.settings.active_car_id ?? null;
  const scenario = cfg?.settings.active_car_scenario ?? "sem_carro";
  const semCarro = scenario === "sem_carro";
  // Combustível/mês desta residência (campus × dias de aula) — vem das views;
  // a Regra 1 zera quando o cenário é sem_carro.
  const fuelCampus = num(overview?.cost?.fuel_campus_eur);

  async function chooseCar(c: CarConfigRow) {
    await patchSettings({ active_car_id: c.id, active_car_scenario: c.scenario });
  }

  async function removeCar(id: string) {
    const res = await fetch(`/api/config/car/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (id === activeId) await patchSettings({ active_car_id: null });
      load();
    }
  }

  async function createCar(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const n = (v: string) => (v.trim() === "" ? null : Number(v));
      const res = await fetch("/api/config/car", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: form.scenario,
          source: form.source.trim() || null,
          model: form.model.trim() || null,
          km_included: n(form.km_included),
          monthly_eur: n(form.monthly_eur),
          purchase_price_eur: n(form.purchase_price_eur),
          resale_estimate_eur: n(form.resale_estimate_eur),
          months: n(form.months),
          insurance_eur: n(form.insurance_eur),
          insurance_deductible_eur: n(form.insurance_deductible_eur),
          tolls_eur: n(form.tolls_eur),
          home_parking_eur: n(form.home_parking_eur),
          maintenance_eur: n(form.maintenance_eur),
        }),
      });
      if (res.ok) {
        setForm({ ...EMPTY_FORM });
        load();
      }
    } finally {
      setCreating(false);
    }
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-mute">
          Cadastre carros de qualquer site e compare; o escolhido entra no custo de vida.
        </p>
        <SaveIndicator state={saveState} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Notice tone="info">
          <span className="font-medium text-ink">Router:</span> SKEMA de carro:{" "}
          {overview?.nearest.find((p) => p.category === "campus")?.duration_min ?? "—"} min ·
          combustível campus desta residência:{" "}
          {semCarro ? (
            <>— (cenário atual é sem carro)</>
          ) : fuelCampus !== null ? (
            <>≈ {eur2(fuelCampus)}/mês [auto: trajeto × dias de aula]</>
          ) : (
            <>—</>
          )}
        </Notice>
        {cars.length === 0 ? (
          <Notice tone="todo">
            <span className="font-medium text-ink">Falta você (1):</span> cadastrar o primeiro carro
            para comparar com a vida sem carro.
          </Notice>
        ) : (
          <Notice tone={semCarro ? "info" : "ok"}>
            Este ano:{" "}
            <span className="font-medium text-ink">
              {semCarro ? "sem carro (passe de transporte ativo)" : "com carro"}
            </span>{" "}
            — troque no botão abaixo; combustível e passe são mutuamente exclusivos no custo de vida.
          </Notice>
        )}
      </div>

      {/* com carro × sem carro — a decisão que muda o mês inteiro
          (só renderiza com o config carregado, para não piscar o estado errado) */}
      {cfg && (
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={!semCarro}
          onClick={() => {
            const active = cars.find((c) => c.id === activeId) ?? cars[0];
            if (active) void patchSettings({ active_car_scenario: active.scenario, active_car_id: active.id });
          }}
          disabled={cars.length === 0}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            !semCarro ? "border-gold bg-gold/10 text-gold-hi" : "border-line bg-card-2 text-ink-2 hover:border-gold/50"
          }`}
        >
          Com carro
        </button>
        <button
          type="button"
          aria-pressed={semCarro}
          onClick={() => void patchSettings({ active_car_scenario: "sem_carro" })}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            semCarro ? "border-gold bg-gold/10 text-gold-hi" : "border-line bg-card-2 text-ink-2 hover:border-gold/50"
          }`}
        >
          Sem carro
        </button>
      </div>
      )}

      {/* os carros cadastrados — ficha editável, total [auto] */}
      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        {cars.map((c) => {
          const active = c.id === activeId && !semCarro;
          const fixed = carFixedMonthly(c);
          const total = fixed + (semCarro ? 0 : fuelCampus ?? 0);
          return (
            <CarCard
              key={c.id}
              car={c}
              active={active}
              fixed={fixed}
              total={total}
              fuel={semCarro ? null : fuelCampus}
              onChoose={() => void chooseCar(c)}
              onRemove={() => void removeCar(c.id)}
              onSaved={load}
            />
          );
        })}
      </div>

      {/* cadastrar carro de outro site */}
      <details className="mt-4 rounded-xl border border-line bg-card-2/40 p-4">
        <summary className="microlabel cursor-pointer text-gold-hi">
          + cadastrar carro de outro site
        </summary>
        <form onSubmit={createCar} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="microlabel text-mute">site / fonte</span>
            <input value={form.source} onChange={set("source")} placeholder="Sixt, leasys.com…" className={`mt-1 ${INPUT_CLS}`} />
          </label>
          <label className="block">
            <span className="microlabel text-mute">modelo</span>
            <input value={form.model} onChange={set("model")} placeholder="Citroën C3 …" className={`mt-1 ${INPUT_CLS}`} />
          </label>
          <label className="block">
            <span className="microlabel text-mute">tipo</span>
            <select value={form.scenario} onChange={set("scenario")} className={`mt-1 ${INPUT_CLS}`}>
              <option value="leasing">Aluguel / leasing</option>
              <option value="aluguel_curto">Aluguel curto</option>
              <option value="comprar">Comprar</option>
            </select>
          </label>
          <label className="block">
            <span className="microlabel text-mute">km inclusos / mês</span>
            <input type="number" value={form.km_included} onChange={set("km_included")} placeholder="1250" className={`mt-1 ${INPUT_CLS}`} />
          </label>
          <label className="block">
            <span className="microlabel text-mute">mensalidade €</span>
            <input type="number" step="0.01" value={form.monthly_eur} onChange={set("monthly_eur")} placeholder="529" className={`mt-1 ${INPUT_CLS}`} />
          </label>
          <label className="block">
            <span className="microlabel text-mute">meses (contrato/uso)</span>
            <input type="number" value={form.months} onChange={set("months")} placeholder="12" className={`mt-1 ${INPUT_CLS}`} />
          </label>
          {form.scenario === "comprar" && (
            <>
              <label className="block">
                <span className="microlabel text-mute">preço de compra €</span>
                <input type="number" step="0.01" value={form.purchase_price_eur} onChange={set("purchase_price_eur")} className={`mt-1 ${INPUT_CLS}`} />
              </label>
              <label className="block">
                <span className="microlabel text-mute">revenda estimada €</span>
                <input type="number" step="0.01" value={form.resale_estimate_eur} onChange={set("resale_estimate_eur")} className={`mt-1 ${INPUT_CLS}`} />
              </label>
            </>
          )}
          <label className="block">
            <span className="microlabel text-mute">seguro € / mês</span>
            <input type="number" step="0.01" value={form.insurance_eur} onChange={set("insurance_eur")} placeholder="90" className={`mt-1 ${INPUT_CLS}`} />
          </label>
          <label className="block">
            <span className="microlabel text-mute">franquia do seguro €</span>
            <input type="number" step="0.01" value={form.insurance_deductible_eur} onChange={set("insurance_deductible_eur")} className={`mt-1 ${INPUT_CLS}`} />
          </label>
          <label className="block">
            <span className="microlabel text-mute">pedágios € / mês</span>
            <input type="number" step="0.01" value={form.tolls_eur} onChange={set("tolls_eur")} className={`mt-1 ${INPUT_CLS}`} />
          </label>
          <label className="block">
            <span className="microlabel text-mute">estacionamento em casa € / mês</span>
            <input type="number" step="0.01" value={form.home_parking_eur} onChange={set("home_parking_eur")} className={`mt-1 ${INPUT_CLS}`} />
          </label>
          <label className="block">
            <span className="microlabel text-mute">manutenção / imprevistos € / mês</span>
            <input type="number" step="0.01" value={form.maintenance_eur} onChange={set("maintenance_eur")} className={`mt-1 ${INPUT_CLS}`} />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-sky transition-colors hover:bg-gold-hi disabled:opacity-60"
            >
              {creating ? "Cadastrando…" : "Cadastrar carro"}
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}

/* ── card de um carro: ficha editável + totais [auto] ── */

function CarCard({
  car,
  active,
  fixed,
  total,
  fuel,
  onChoose,
  onRemove,
  onSaved,
}: {
  car: CarConfigRow;
  active: boolean;
  fixed: number;
  total: number;
  fuel: number | null;
  onChoose: () => void;
  onRemove: () => void;
  onSaved: () => void;
}) {
  const { patch } = useAutosave(`/api/config/car/${car.id}`, onSaved);
  const [armed, setArmed] = useState(false);

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        active ? "border-gold bg-gold/10" : "border-line bg-card-2"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-pressed={active}
          onClick={onChoose}
          title="este é o meu carro"
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            active ? "border-gold" : "border-mute/50 hover:border-gold/60"
          }`}
        >
          {active && <span className="h-2.5 w-2.5 rounded-full bg-gold" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{car.model ?? "(sem modelo)"}</p>
          <p className="mt-0.5 text-xs text-mute">
            {SCENARIO_PT[car.scenario] ?? car.scenario}
            {car.km_included != null && <> · {car.km_included} km/mês</>}
            {car.source && <> · {car.source}</>}
          </p>
        </div>
        <button
          type="button"
          aria-label={armed ? "confirmar exclusão" : "apagar carro"}
          onClick={() => (armed ? onRemove() : setArmed(true))}
          onBlur={() => setArmed(false)}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            armed ? "bg-bad/15 text-bad" : "text-mute hover:bg-bad/10 hover:text-bad"
          }`}
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          {armed && "apagar?"}
        </button>
      </div>

      {/* ficha editável (autosave por campo) */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <NumberField label="mensalidade €" name="monthly_eur" initial={car.monthly_eur} patch={patch} />
        <NumberField label="km inclusos / mês" name="km_included" initial={car.km_included} patch={patch} step="1" />
        {car.scenario === "comprar" && (
          <>
            <NumberField label="compra €" name="purchase_price_eur" initial={car.purchase_price_eur} patch={patch} />
            <NumberField label="revenda estimada €" name="resale_estimate_eur" initial={car.resale_estimate_eur} patch={patch} />
            <NumberField label="meses de uso" name="months" initial={car.months} patch={patch} step="1" />
          </>
        )}
        <NumberField label="seguro € / mês" name="insurance_eur" initial={car.insurance_eur} patch={patch} />
        <NumberField label="franquia €" name="insurance_deductible_eur" initial={car.insurance_deductible_eur} patch={patch} />
        <NumberField label="pedágios € / mês" name="tolls_eur" initial={car.tolls_eur} patch={patch} />
        <NumberField label="estacionamento casa €" name="home_parking_eur" initial={car.home_parking_eur} patch={patch} />
        <NumberField label="manutenção € / mês" name="maintenance_eur" initial={car.maintenance_eur} patch={patch} />
      </div>

      {/* os [auto] */}
      <div className="mt-3 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2.5">
        <p className="text-sm text-ink-2">
          Fixos: <span className="font-semibold text-ink">{eur(fixed)}</span>
          {car.scenario === "comprar" && num(car.months) ? " (compra amortizada inclusa)" : ""}
          {fuel !== null && (
            <>
              {" "}
              + combustível {eur2(fuel)} ={" "}
              <span className="font-semibold text-gold-hi">{eur(total)} / mês nesta residência</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
