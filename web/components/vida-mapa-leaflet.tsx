"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { divIcon, latLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapData, MapPin } from "@/lib/types";

/* ── O miolo Leaflet do "céu no mapa" ────────────────────────────────────────
   Só roda no cliente (o wrapper importa com ssr: false). Pins são divIcon com
   emoji por categoria (evita o bug do ícone default do Leaflet com bundler);
   o sol é maior e dourado. fitBounds ignora travel_hub — o aeroporto não pode
   afastar o zoom do dia a dia; os hubs aparecem ao dar zoom out. */

const CATEGORY: Record<string, { glyph: string; label: string }> = {
  supermarket: { glyph: "🛒", label: "Supermercado" },
  bakery: { glyph: "🥖", label: "Padaria" },
  restaurant: { glyph: "🍽️", label: "Restaurante" },
  bar: { glyph: "🍺", label: "Bar" },
  gym: { glyph: "🏋️", label: "Academia" },
  church: { glyph: "⛪", label: "Igreja" },
  library: { glyph: "📚", label: "Biblioteca" },
  coworking: { glyph: "💻", label: "Coworking" },
  campus: { glyph: "🎓", label: "Campus" },
  travel_hub: { glyph: "✈️", label: "Hub de viagem" },
  bus_stop: { glyph: "🚌", label: "Ponto de ônibus" },
  gare: { glyph: "🚉", label: "Gare" },
  gas_station: { glyph: "⛽", label: "Posto" },
  hair_salon: { glyph: "✂️", label: "Cabeleireiro" },
  shopping_mall: { glyph: "🛍️", label: "Shopping" },
  hospital: { glyph: "🏥", label: "Hospital" },
  pharmacy: { glyph: "💊", label: "Farmácia" },
};

function pinIcon(category: string) {
  return divIcon({
    className: "",
    html: `<div class="map-pin">${CATEGORY[category]?.glyph ?? "📍"}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

const sunIcon = divIcon({
  className: "",
  html: `<div class="map-pin map-pin-sun">🏠</div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

function tempos(p: MapPin): string | null {
  const parts = [
    p.walkMin != null ? `${p.walkMin} min a pé` : null,
    p.driveMin != null ? `${p.driveMin} min de carro` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function VidaMapaLeaflet({ data }: { data: MapData }) {
  const { apartment, pins } = data;
  const sol: [number, number] = [apartment.lat!, apartment.lng!];

  // enquadra o dia a dia (sol + seleções + campus + gares); hubs ficam fora
  const bounds = latLngBounds([
    sol,
    ...pins
      .filter((p) => p.category !== "travel_hub")
      .map((p) => [p.lat, p.lng] as [number, number]),
  ]);

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [40, 40] }}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />

      <Marker position={sol} icon={sunIcon}>
        <Popup>
          <p className="font-semibold">{apartment.name}</p>
          <p className="text-sm">Moradia — o sol</p>
        </Popup>
      </Marker>

      {pins.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p.category)}>
          <Popup>
            <p className="font-semibold">{p.name}</p>
            <p className="text-sm">{CATEGORY[p.category]?.label ?? p.category}</p>
            {tempos(p) && <p className="text-sm">{tempos(p)}</p>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
