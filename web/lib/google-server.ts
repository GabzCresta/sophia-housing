import { readFileSync } from "node:fs";
import path from "node:path";

/* ── Google no SERVIDOR (rotas API apenas) ───────────────────────────────────
   A chave vive no .env da RAIZ (gitignored) e nunca chega ao browser — o
   front continua falando só com /api/*. Uso pontual: buscar um lugar digitado
   pelo Gabriel e medir a rota dele (o grosso continua no scripts/router.js). */

let cachedKey: string | null = null;

export function googleKey(): string {
  if (cachedKey) return cachedKey;
  if (process.env.GOOGLE_MAPS_API_KEY) return (cachedKey = process.env.GOOGLE_MAPS_API_KEY);
  const env = readFileSync(path.resolve(process.cwd(), "..", ".env"), "utf8");
  const m = env.match(/^GOOGLE_MAPS_API_KEY=(.+)$/m);
  if (!m) throw new Error("GOOGLE_MAPS_API_KEY não encontrada no .env da raiz");
  return (cachedKey = m[1].trim());
}

export interface FoundPlace {
  google_place_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  rating: number | null;
}

/** Places Text Search (New) com viés na localização do apê. */
export async function searchPlaces(
  query: string,
  bias: { lat: number; lng: number } | null,
  maxResults = 5,
): Promise<FoundPlace[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": googleKey(),
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: maxResults,
      ...(bias
        ? {
            locationBias: {
              circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 15000 },
            },
          }
        : {}),
    }),
  });
  if (!res.ok) throw new Error(`Places Text Search ${res.status}`);
  const body = await res.json();
  return ((body.places ?? []) as Array<Record<string, any>>).map((p) => ({
    google_place_id: p.id,
    name: p.displayName?.text ?? "(sem nome)",
    address: p.formattedAddress ?? null,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    rating: p.rating ?? null,
  }));
}

/** Distance Matrix (1 origem → 1 destino) num modo. */
export async function measureRoute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  mode: "driving" | "walking",
): Promise<{ distance_m: number; duration_s: number } | null> {
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${origin.lat},${origin.lng}&destinations=${dest.lat},${dest.lng}` +
    `&mode=${mode}&key=${googleKey()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const body = await res.json();
  const el = body.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK") return null;
  return { distance_m: el.distance.value, duration_s: el.duration.value };
}
