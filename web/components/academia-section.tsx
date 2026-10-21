"use client";

import { useCallback, useEffect, useState } from "react";
import { RouterNotice } from "@/components/router-notice";
import {
  Group,
  INPUT_CLS,
  Notice,
  NumberField,
  SaveIndicator,
  useAutosave,
} from "@/components/section-ui";
import { eur, eur2, num } from "@/lib/format";
import type { ConfigData, GymOption } from "@/lib/types";

/** Resultado do auto-search (rota /api/places/search — a chave fica no servidor). */
interface FoundPlace {
  google_place_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  rating: number | null;
}

/* ── Seção Academia (molde do kit) ───────────────────────────────────────────
   O router lista e mede; preços das redes (Fitness Park €30/12m, Basic-Fit
   €24,99/4sem ≈ €27/mês real) pesquisados em jul/2026 e pré-preenchidos — o
   resto você edita na própria linha. A mensalidade da SUA academia entra no
   custo de vida. Dá para adicionar academia que o router não achou. */

export function AcademiaSection({
  apartmentId,
  gyms,
  onChanged,
}: {
  apartmentId: string;
  gyms: GymOption[];
  onChanged: () => void;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addFee, setAddFee] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FoundPlace[] | null>(null);
  const [picked, setPicked] = useState<FoundPlace | null>(null);
  const [cfg, setCfg] = useState<ConfigData["settings"] | null>(null);
  const selected = gyms.find((g) => g.selected) ?? null;
  const within10 = gyms.filter((g) => g.walkMin != null && g.walkMin <= 10).length;

  // Config global (treinos/mês, preço do litro, consumo) — fetch da própria seção.
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

  // Gasolina/mês até a SUA academia: ida e volta × treinos × consumo × preço.
  const trips = cfg?.gym_trips_per_month ?? null;
  const fuelPrice = cfg?.fuel_price_eur_per_l ?? null;
  const consumption = cfg?.car_consumption_l_per_100km ?? null;
  const kmRoundTrip = selected?.driveM != null ? (selected.driveM / 1000) * 2 : null;
  const fuelMonthly =
    kmRoundTrip !== null && trips !== null && fuelPrice !== null && consumption !== null
      ? kmRoundTrip * trips * (consumption / 100) * fuelPrice
      : null;

  async function choose(g: GymOption) {
    setSavingId(g.id);
    try {
      const res = await fetch(`/api/apartments/${apartmentId}/selection`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "gym", place_id: g.selected ? null : g.id }),
      });
      if (res.ok) onChanged();
    } finally {
      setSavingId(null);
    }
  }

  async function searchGym() {
    if (addName.trim().length < 3) return;
    setSearching(true);
    setAddError(null);
    setResults(null);
    setPicked(null);
    try {
      const res = await fetch(
        `/api/places/search?q=${encodeURIComponent(addName.trim() + " Antibes")}&apartment=${apartmentId}`,
      );
      if (!res.ok) {
        setAddError("A busca no mapa falhou — dá para adicionar sem ela.");
        return;
      }
      const found: FoundPlace[] = await res.json();
      setResults(found);
      if (found.length === 0) setAddError("Nada encontrado — confira o nome ou adicione sem mapa.");
    } finally {
      setSearching(false);
    }
  }

  async function addGym(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/places/gym", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: picked?.name ?? addName.trim(),
          monthly_fee_eur: addFee.trim() === "" ? null : Number(addFee),
          // com resultado do mapa: rotas medidas na hora → gasolina calculável
          ...(picked
            ? {
                google_place_id: picked.google_place_id,
                address: picked.address,
                lat: picked.lat,
                lng: picked.lng,
                rating: picked.rating,
                apartment_id: apartmentId,
              }
            : {}),
        }),
      });
      if (res.status === 409) {
        setAddError("Essa academia já está na lista.");
        return;
      }
      if (!res.ok) {
        setAddError("Não consegui adicionar — confira o nome.");
        return;
      }
      setAddName("");
      setAddFee("");
      setResults(null);
      setPicked(null);
      onChanged();
    } finally {
      setAdding(false);
    }
  }

  if (gyms.length === 0) {
    return (
      <RouterNotice
        apartmentId={apartmentId}
        message="nenhuma academia medida ainda para este endereço"
        onDone={onChanged}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-mute">
          O router lista e mede; preços das redes pesquisados (jul/2026) — os demais você edita na
          própria linha. A mensalidade da sua academia entra no custo de vida.
        </p>
        <SaveIndicator state={saveState} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Notice tone="info">
          <span className="font-medium text-ink">Router achou {gyms.length} academias/estúdios</span>
          {" · "}
          {within10} a até 10 min a pé · preços: Fitness Park e Basic-Fit pesquisados; estúdios
          variam demais — informe o seu
        </Notice>
        {selected ? (
          <Notice tone="ok">
            A sua academia: <span className="font-medium text-ink">{selected.name}</span>
            {num(selected.monthly_fee_eur) !== null && (
              <>
                {" "}
                — <span className="font-medium text-ink">{eur(selected.monthly_fee_eur)}/mês</span>{" "}
                no custo de vida
              </>
            )}{" "}
            · clique nela de novo para desfazer.
          </Notice>
        ) : (
          <Notice tone="todo">
            <span className="font-medium text-ink">Falta você (1):</span> marcar a SUA academia — a
            mensalidade dela entra no custo de vida.
          </Notice>
        )}
      </div>

      {/* gasolina até a academia — treinos/mês é seu; o resto o app já sabe */}
      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        <Group title="gasolina até a academia">
          <NumberField
            label="treinos / mês"
            name="gym_trips_per_month"
            initial={cfg?.gym_trips_per_month ?? null}
            patch={patchSettings}
            step="1"
            placeholder="12"
          />
          {!selected ? (
            <p className="text-xs text-mute">
              Marque a SUA academia na lista — a conta usa a distância de carro dela.
            </p>
          ) : selected.driveM == null ? (
            <p className="text-xs text-mute">Sem rota de carro medida para {selected.name}.</p>
          ) : trips === null ? (
            <p className="text-xs text-mute">Diga os treinos/mês para eu fechar a conta.</p>
          ) : (
            <div>
              <p className="text-xl font-semibold text-ink">
                ≈ {eur2(fuelMonthly)} <span className="text-sm font-normal text-mute">/ mês</span>
              </p>
              <p className="mt-1 text-xs text-mute">
                {kmRoundTrip!.toFixed(1).replace(".", ",")} km ida e volta até {selected.name} ×{" "}
                {trips} treinos · {consumption ?? "—"} L/100km · €{fuelPrice ?? "—"}/L
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

      {/* a lista: radio + mensalidade editável por linha */}
      <ul className="mt-4 flex flex-col gap-2">
        {gyms.map((g) => (
          <GymRow
            key={g.id}
            gym={g}
            saving={savingId === g.id}
            onChoose={() => void choose(g)}
            onSaved={onChanged}
          />
        ))}
      </ul>

      {/* adicionar academia que o router não achou */}
      <form
        onSubmit={addGym}
        className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card-2/40 p-4"
      >
        <label className="min-w-56 flex-1">
          <span className="microlabel text-gold-hi">+ adicionar academia</span>
          <input
            value={addName}
            onChange={(e) => {
              setAddName(e.target.value);
              setPicked(null);
            }}
            placeholder="nome (ex.: CrossFit Antibes)"
            required
            minLength={2}
            className={`mt-1 ${INPUT_CLS}`}
          />
        </label>
        <button
          type="button"
          disabled={searching || addName.trim().length < 3}
          onClick={() => void searchGym()}
          className="rounded-lg border border-info/40 bg-info/10 px-4 py-2 text-sm font-semibold text-info transition-colors hover:bg-info/20 disabled:opacity-50"
        >
          {searching ? "Buscando…" : "Buscar no mapa"}
        </button>
        {results && results.length > 0 && (
          <div className="w-full rounded-lg border border-info/30 bg-info/5 p-2">
            <p className="microlabel px-2 pb-1 text-info">achei no mapa — escolha o certo:</p>
            {results.map((r) => (
              <button
                key={r.google_place_id}
                type="button"
                onClick={() => {
                  setPicked(r);
                  setAddName(r.name);
                }}
                className={`flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  picked?.google_place_id === r.google_place_id
                    ? "bg-gold/15 text-gold-hi"
                    : "text-ink-2 hover:bg-card-2"
                }`}
              >
                <span className="font-medium text-ink">{r.name}</span>
                {r.rating != null && <span className="text-xs">★ {String(r.rating).replace(".", ",")}</span>}
                <span className="min-w-0 flex-1 truncate text-xs text-mute">{r.address}</span>
              </button>
            ))}
          </div>
        )}
        <label className="w-40">
          <span className="microlabel text-mute">mensalidade €</span>
          <input
            type="number"
            step="0.5"
            value={addFee}
            onChange={(e) => setAddFee(e.target.value)}
            placeholder="opcional"
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
        {addError && <p className="w-full text-sm text-bad">{addError}</p>}
        <p className="w-full text-xs text-mute">
          {picked
            ? "Distâncias medidas na hora ao adicionar — tempos e gasolina já saem prontos."
            : "Use o Buscar no mapa para medir distâncias e calcular gasolina; sem busca, entra sem tempos."}
        </p>
      </form>
    </div>
  );
}

/* ── uma academia: radio + info + mensalidade editável + tempos ── */

function GymRow({
  gym,
  saving,
  onChoose,
  onSaved,
}: {
  gym: GymOption;
  saving: boolean;
  onChoose: () => void;
  onSaved: () => void;
}) {
  const { patch } = useAutosave(`/api/places/${gym.id}/gym`, onSaved);
  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 transition-colors ${
        gym.selected ? "border-gold bg-gold/10" : "border-line bg-card-2"
      }`}
    >
      <button
        type="button"
        disabled={saving}
        onClick={onChoose}
        aria-pressed={gym.selected}
        title="esta é a minha"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 disabled:opacity-60 ${
          gym.selected ? "border-gold" : "border-mute/50 hover:border-gold/60"
        }`}
      >
        {gym.selected && <span className="h-2.5 w-2.5 rounded-full bg-gold" />}
      </button>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{gym.name}</span>
        <span className="mt-0.5 block text-xs text-mute">
          {[
            gym.rating != null ? `★ ${String(gym.rating).replace(".", ",")}` : null,
            gym.walkMin == null && gym.driveMin == null ? "manual — sem rotas ainda" : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </span>
      </span>

      {/* mensalidade editável na linha (autosave) */}
      <span className="w-36 shrink-0">
        <NumberField
          label="mensalidade €"
          name="monthly_fee_eur"
          initial={gym.monthly_fee_eur}
          patch={patch}
          step="0.5"
          placeholder="?"
        />
      </span>

      <span className="w-28 shrink-0 text-right text-sm text-ink-2">
        <span className="block">{gym.walkMin != null ? `${gym.walkMin} min a pé` : "a pé —"}</span>
        <span className="block text-xs text-mute">
          {gym.driveMin != null ? `${gym.driveMin} min de carro` : "carro —"}
        </span>
      </span>
    </li>
  );
}
