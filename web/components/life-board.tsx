"use client";

import { useCallback, useEffect, useState } from "react";
import { SECTIONS, type SectionStatus } from "@/lib/sections";
import { MoradiaSection } from "@/components/moradia-section";
import { RouterNotice } from "@/components/router-notice";
import { SupermercadoSection } from "@/components/supermercado-section";
import { PakiSection } from "@/components/paki-section";
import { RestauranteSection } from "@/components/restaurante-section";
import { TransporteSection } from "@/components/transporte-section";
import { CarroSection } from "@/components/carro-section";
import { AcademiaSection } from "@/components/academia-section";
import { IgrejaSection } from "@/components/igreja-section";
import { ViajarSection } from "@/components/viajar-section";
import { IaSection } from "@/components/ia-section";
import { CabeleireiroSection } from "@/components/cabeleireiro-section";
import { ShoppingSection } from "@/components/shopping-section";
import { MedicoSection } from "@/components/medico-section";
import { moradiaStatus } from "@/lib/moradia";
import { supermercadoStatus } from "@/lib/supermercado";
import { restauranteStatus } from "@/lib/restaurante";
import { transporteStatus } from "@/lib/transporte";
import { carroStatus } from "@/lib/carro";
import { academiaStatus } from "@/lib/academia";
import { igrejaStatus } from "@/lib/igreja";
import { cabeleireiroStatus } from "@/lib/cabeleireiro";
import type { ApartmentFull, ConfigData, GymOption, PlaceOption } from "@/lib/types";

interface BoardApartment {
  id: string;
  name: string;
  address: string | null;
}

const DOT: Record<SectionStatus, { cls: string; title: string }> = {
  todo: { cls: "bg-warn", title: "falta input seu" },
  router: { cls: "bg-info", title: "aguardando router" },
  ok: { cls: "bg-good", title: "seção completa" },
};

/** O quadro da vida: as 12 seções em mini-cards clicáveis, na largura da tela.
 *  O pontinho de status diz de quem é a vez: âmbar = você, azul = router,
 *  verde = completa. O board é dono dos dados (o pontinho existe com o card
 *  fechado) e recarrega tudo após gravações e no focus da janela (router pode
 *  rodar por fora — os campos aparecem sem F5). */
export function LifeBoard({ apartment }: { apartment: BoardApartment | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const [full, setFull] = useState<ApartmentFull | null>(null);
  const [superPlaces, setSuperPlaces] = useState<PlaceOption[] | null>(null);
  const [pakiPlaces, setPakiPlaces] = useState<PlaceOption[] | null>(null);
  const [restaurantPlaces, setRestaurantPlaces] = useState<PlaceOption[] | null>(null);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [gyms, setGyms] = useState<GymOption[] | null>(null);
  const [churches, setChurches] = useState<PlaceOption[] | null>(null);
  const [salons, setSalons] = useState<PlaceOption[] | null>(null);
  const [malls, setMalls] = useState<PlaceOption[] | null>(null);
  const [hospitals, setHospitals] = useState<PlaceOption[] | null>(null);
  const [pharmacies, setPharmacies] = useState<PlaceOption[] | null>(null);
  const active = SECTIONS.find((s) => s.key === open) ?? null;

  const load = useCallback(() => {
    if (!apartment) return;
    window.dispatchEvent(new Event("sophia:changed")); // o resumo de gastos escuta
    fetch(`/api/apartments/${apartment.id}/full`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setFull(d))
      .catch(() => setFull(null));
    fetch(`/api/apartments/${apartment.id}/pillar/supermarket`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSuperPlaces(d))
      .catch(() => setSuperPlaces(null));
    fetch(`/api/apartments/${apartment.id}/pillar/paki`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPakiPlaces(d))
      .catch(() => setPakiPlaces(null));
    fetch(`/api/apartments/${apartment.id}/pillar/restaurant`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRestaurantPlaces(d))
      .catch(() => setRestaurantPlaces(null));
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConfig(d))
      .catch(() => setConfig(null));
    fetch(`/api/apartments/${apartment.id}/pillar/gym`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setGyms(d))
      .catch(() => setGyms(null));
    fetch(`/api/apartments/${apartment.id}/pillar/church`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setChurches(d))
      .catch(() => setChurches(null));
    fetch(`/api/apartments/${apartment.id}/pillar/hair_salon`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSalons(d))
      .catch(() => setSalons(null));
    fetch(`/api/apartments/${apartment.id}/pillar/shopping_mall`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMalls(d))
      .catch(() => setMalls(null));
    fetch(`/api/apartments/${apartment.id}/pillar/hospital`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHospitals(d))
      .catch(() => setHospitals(null));
    fetch(`/api/apartments/${apartment.id}/pillar/pharmacy`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPharmacies(d))
      .catch(() => setPharmacies(null));
  }, [apartment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setFull(null);
    setSuperPlaces(null);
    setPakiPlaces(null);
    setRestaurantPlaces(null);
    setGyms(null);
    setChurches(null);
    setSalons(null);
    setMalls(null);
    setHospitals(null);
    setPharmacies(null);
    load();
  }, [load]);

  useEffect(() => {
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  const statusOf = (key: string): SectionStatus | null => {
    if (!apartment) return null;
    if (key === "moradia") return full ? moradiaStatus(full) : null;
    if (key === "supermercado") return superPlaces ? supermercadoStatus(superPlaces) : null;
    if (key === "paki") return pakiPlaces ? (pakiPlaces.length > 0 ? "ok" : "router") : null;
    if (key === "restaurante") return restaurantPlaces ? restauranteStatus(restaurantPlaces) : null;
    if (key === "transporte") return transporteStatus(config);
    if (key === "carro") return carroStatus(config);
    if (key === "academia") return gyms ? academiaStatus(gyms) : null;
    if (key === "igreja") return churches ? igrejaStatus(churches) : null;
    if (key === "viajar") return config ? (config.settings.travel_budget_eur != null ? "ok" : "todo") : null;
    if (key === "ia") return config ? (config.aiSubscriptions.length > 0 ? "ok" : "todo") : null;
    if (key === "cabeleireiro") return salons ? cabeleireiroStatus(salons) : null;
    if (key === "shopping")
      return config ? (config.settings.shopping_budget_eur != null ? "ok" : "todo") : null;
    if (key === "medico")
      return config ? (config.settings.health_budget_eur != null ? "ok" : "todo") : null;
    return null;
  };

  return (
    <section className="w-full rounded-2xl border border-line bg-card p-6">
      <p className="microlabel text-gold-hi">a vida a partir daqui</p>
      {apartment ? (
        <>
          <h2 className="mt-3 font-display text-xl font-semibold">
            O que orbita {apartment.name}
          </h2>
          <p className="mt-1 text-sm text-mute">
            {apartment.address ?? "sem endereço"} — cada seção guarda distâncias e custos; clique para abrir.
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-3 font-display text-xl font-semibold">Nenhuma residência aberta</h2>
          <p className="mt-1 text-sm text-mute">
            Abra uma no menu ⋯ ou cadastre uma nova — o quadro passa a ser dela.
          </p>
        </>
      )}

      {/* PADRÃO: residência sem medição → um botão mestre preenche TUDO
          (geocode + lugares + rotas de todas as categorias de uma vez). */}
      {apartment && full?.routes_stale && (
        <div className="mt-6">
          <RouterNotice
            apartmentId={apartment.id}
            message="esta residência ainda não foi medida — o router preenche TODAS as seções (lugares, tempos, gasolina; leva alguns minutos)"
            onDone={load}
          />
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {SECTIONS.map(({ key, label, Icon }) => {
          const selected = open === key;
          const status = statusOf(key);
          return (
            <button
              key={key}
              type="button"
              aria-expanded={selected}
              onClick={() => setOpen(selected ? null : key)}
              className={`group flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                selected
                  ? "border-gold bg-gold/10"
                  : "border-line bg-card-2 hover:border-gold/50"
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 transition-colors ${
                  selected ? "text-gold-hi" : "text-ink-2 group-hover:text-gold-hi"
                }`}
                strokeWidth={1.75}
              />
              <span className="text-sm font-medium text-ink">{label}</span>
              {status && (
                <span
                  className={`ml-auto h-2 w-2 shrink-0 rounded-full ${DOT[status].cls}`}
                  title={DOT[status].title}
                />
              )}
            </button>
          );
        })}
      </div>

      {active && (
        <div className="mt-4 rounded-xl border border-line bg-sky/60 p-5">
          <div className="flex items-center gap-2.5">
            <active.Icon className="h-5 w-5 text-gold-hi" strokeWidth={1.75} />
            <h3 className="font-display text-lg font-semibold">{active.label}</h3>
          </div>

          {!apartment ? (
            <p className="mt-2 text-sm text-mute">
              Abra uma residência (menu ⋯ ou cadastro) para esta seção ter dados.
            </p>
          ) : active.key === "moradia" ? (
            <div className="mt-4">
              {full ? (
                <MoradiaSection apartmentId={apartment.id} data={full} onSaved={load} />
              ) : (
                <p className="text-sm text-mute">Carregando a ficha…</p>
              )}
            </div>
          ) : active.key === "supermercado" ? (
            <div className="mt-4">
              {superPlaces ? (
                <SupermercadoSection
                  apartmentId={apartment.id}
                  places={superPlaces}
                  onChanged={load}
                />
              ) : (
                <p className="text-sm text-mute">Carregando os mercados…</p>
              )}
            </div>
          ) : active.key === "paki" ? (
            <div className="mt-4">
              {pakiPlaces ? (
                <PakiSection apartmentId={apartment.id} places={pakiPlaces} onChanged={load} />
              ) : (
                <p className="text-sm text-mute">Carregando as mercearias…</p>
              )}
            </div>
          ) : active.key === "restaurante" ? (
            <div className="mt-4">
              {restaurantPlaces ? (
                <RestauranteSection
                  apartmentId={apartment.id}
                  places={restaurantPlaces}
                  onChanged={load}
                />
              ) : (
                <p className="text-sm text-mute">Carregando os restaurantes…</p>
              )}
            </div>
          ) : active.key === "transporte" ? (
            <div className="mt-4">
              <TransporteSection apartmentId={apartment.id} onChanged={load} />
            </div>
          ) : active.key === "carro" ? (
            <div className="mt-4">
              <CarroSection apartmentId={apartment.id} onChanged={load} />
            </div>
          ) : active.key === "academia" ? (
            <div className="mt-4">
              {gyms ? (
                <AcademiaSection apartmentId={apartment.id} gyms={gyms} onChanged={load} />
              ) : (
                <p className="text-sm text-mute">Carregando as academias…</p>
              )}
            </div>
          ) : active.key === "igreja" ? (
            <div className="mt-4">
              {churches ? (
                <IgrejaSection apartmentId={apartment.id} places={churches} onChanged={load} />
              ) : (
                <p className="text-sm text-mute">Carregando as igrejas…</p>
              )}
            </div>
          ) : active.key === "viajar" ? (
            <div className="mt-4">
              <ViajarSection onChanged={load} />
            </div>
          ) : active.key === "ia" ? (
            <div className="mt-4">
              <IaSection onChanged={load} />
            </div>
          ) : active.key === "cabeleireiro" ? (
            <div className="mt-4">
              {salons ? (
                <CabeleireiroSection apartmentId={apartment.id} places={salons} onChanged={load} />
              ) : (
                <p className="text-sm text-mute">Carregando os cabeleireiros…</p>
              )}
            </div>
          ) : active.key === "shopping" ? (
            <div className="mt-4">
              {malls ? (
                <ShoppingSection apartmentId={apartment.id} places={malls} onChanged={load} />
              ) : (
                <p className="text-sm text-mute">Carregando os shoppings…</p>
              )}
            </div>
          ) : active.key === "medico" ? (
            <div className="mt-4">
              {hospitals && pharmacies ? (
                <MedicoSection
                  apartmentId={apartment.id}
                  hospitals={hospitals}
                  pharmacies={pharmacies}
                  onChanged={load}
                />
              ) : (
                <p className="text-sm text-mute">Carregando hospitais e farmácias…</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-mute">
              Seção ainda vazia — aqui vão entrar as informações desta parte da vida
              (distâncias do router ou dados seus). Vamos construí-la em seguida.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
