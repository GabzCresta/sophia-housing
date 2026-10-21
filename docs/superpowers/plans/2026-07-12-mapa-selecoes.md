# "O céu no mapa" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mapa Leaflet abaixo do quadro da vida com o apartamento (sol) e pins de tudo que o usuário escolheu ("esta é a minha") + campus/gares/hubs, com popup nome · categoria · tempos.

**Architecture:** 1 endpoint novo (`/api/apartments/[id]/map`) que junta `apartment_selections` + categorias fixas com os tempos de `routes`; 1 wrapper client (`vida-mapa.tsx`) que faz fetch e escuta `sophia:changed`; 1 miolo Leaflet (`vida-mapa-leaflet.tsx`) carregado com `next/dynamic` `ssr: false`; integração no `page-shell.tsx`.

**Tech Stack:** Next.js 16 (App Router), React 19, `leaflet@^1.9`, `react-leaflet@^5`, tiles CartoDB Dark Matter, Postgres (Docker `sophia_pg`).

**Spec:** `docs/superpowers/specs/2026-07-12-mapa-selecoes-design.md`

## Global Constraints

- **Sem git**: o projeto não é repositório git — não há steps de commit; ao final de cada task, apenas verificar.
- **Sem test runner**: o projeto não tem jest/vitest e NÃO deve ganhar um — verificação real por task (curl, `npx tsc --noEmit`, Playwright), padrão do projeto.
- **Idioma da UI e comentários**: português (PT-BR), tom do restante do app ("o céu", "o sol").
- **Tema**: usar somente tokens existentes de `globals.css` (`--color-card`, `--color-line`, `--color-gold-hi`…); dark only.
- **Next 16**: `ssr: false` só funciona DENTRO de client component (confirmado em `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`) — o `dynamic()` do miolo fica no wrapper `"use client"`.
- **Banco**: `numeric` já chega como `number` no node-pg (type parser em `web/lib/db.ts:5`) — não fazer cast nem parseFloat.
- **Dev server**: dev server já roda em `web/` na porta 3100 (PID existente) — NÃO iniciar outro. Se páginas derem 404 estranho, apagar `web/.next` e reiniciar (cache conhecido).
- **Apê de verificação**: Dominique `0cf217aa-dd85-476b-8085-d68d7c525359` (geocodado, 4 seleções).

---

### Task 1: Tipos + endpoint `GET /api/apartments/[id]/map`

**Files:**
- Modify: `web/lib/types.ts` (fim do arquivo, linha ~340)
- Create: `web/app/api/apartments/[id]/map/route.ts`

**Interfaces:**
- Consumes: `query`/`queryOne` de `@/lib/db`; tabelas `apartments`, `places`, `apartment_selections`, `routes`.
- Produces: `MapPin` e `MapData` exportados de `@/lib/types`; endpoint que responde `MapData` como JSON (Tasks 2 e 3 dependem desses nomes/campos exatos).

- [ ] **Step 1: Adicionar os tipos no fim de `web/lib/types.ts`**

```ts
// ── O céu no mapa (Fase 9) ───────────────────────────────────────────────────
/** Um pin do mapa: seleção "esta é a minha" ou ponto fixo (campus/gare/hub). */
export interface MapPin {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  walkMin: number | null;
  driveMin: number | null;
  selected: boolean;
}

/** Resposta de GET /api/apartments/[id]/map — o sol + os pins. */
export interface MapData {
  apartment: { id: string; name: string; lat: number | null; lng: number | null };
  pins: MapPin[];
}
```

- [ ] **Step 2: Criar `web/app/api/apartments/[id]/map/route.ts`**

```ts
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import type { MapData, MapPin } from "@/lib/types";

// GET /api/apartments/[id]/map — o sol + os pins do céu: as seleções "esta é a
// minha" (qualquer categoria) e os pontos fixos da vida (campus, gares, hubs),
// com os tempos já medidos em routes. O front não renderiza o mapa se o apê
// ainda não tem lat/lng (residência não medida).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const apartment = await queryOne<MapData["apartment"]>(
    `select id, name, lat, lng from apartments where id = $1`,
    [id],
  );
  if (!apartment) {
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }

  const pins = await query<MapPin>(
    `with times as (
       select r.place_id,
              round(max(r.duration_s) filter (where r.mode = 'walking') / 60.0)::int as "walkMin",
              round(max(r.duration_s) filter (where r.mode = 'driving') / 60.0)::int as "driveMin"
         from routes r
        where r.apartment_id = $1
        group by r.place_id
     )
     select p.id, p.name, p.category, p.lat, p.lng,
            t."walkMin", t."driveMin",
            (sel.id is not null) as selected
       from places p
       left join apartment_selections sel
              on sel.place_id = p.id and sel.apartment_id = $1
       left join times t on t.place_id = p.id
      where p.lat is not null and p.lng is not null
        and (sel.id is not null or p.category in ('campus','gare','travel_hub'))
      order by p.category, p.name`,
    [id],
  );

  return NextResponse.json({ apartment, pins } satisfies MapData);
}
```

- [ ] **Step 3: Verificar com curl (dev server rodando em `web/`)**

Run:
```bash
curl -s localhost:3100/api/apartments/0cf217aa-dd85-476b-8085-d68d7c525359/map | python3 -m json.tool | head -40
```
Expected: `apartment` com `lat`/`lng` numéricos (não string); `pins` contendo as 4 seleções do Dominique com `"selected": true` + 1 campus + 2 gares + 7 travel_hubs com `"selected": false`; `walkMin`/`driveMin` inteiros (ou null).

Conferência cruzada (tempos batem com a seção): o `walkMin` do pin da academia selecionada deve ser igual ao mostrado em `/api/apartments/<id>/pillar/gym` para o mesmo place.

```bash
curl -s localhost:3100/api/apartments/0cf217aa-dd85-476b-8085-d68d7c525359/pillar/gym | python3 -c "import json,sys; [print(p['name'], p['walkMin'], p['driveMin']) for p in json.load(sys.stdin) if p['selected']]"
```

E o 404:
```bash
curl -s -o /dev/null -w "%{http_code}" localhost:3100/api/apartments/00000000-0000-0000-0000-000000000000/map
```
Expected: `404`

---

### Task 2: Dependências + miolo Leaflet + CSS dos pins

**Files:**
- Modify: `web/package.json` (via npm install)
- Create: `web/components/vida-mapa-leaflet.tsx`
- Modify: `web/app/globals.css` (fim do arquivo)

**Interfaces:**
- Consumes: `MapData`, `MapPin` de `@/lib/types` (Task 1).
- Produces: `VidaMapaLeaflet({ data }: { data: MapData })` — export nomeado; assume `data.apartment.lat/lng` não-nulos (o wrapper garante). Task 3 importa por `import("@/components/vida-mapa-leaflet").then((m) => m.VidaMapaLeaflet)`.

- [ ] **Step 1: Instalar dependências (dentro de `web/`)**

```bash
cd web && npm install leaflet react-leaflet@^5 && npm install -D @types/leaflet
```
Expected: sem erros de peer deps (react-leaflet v5 requer React 19 — o projeto tem 19.2.4).

- [ ] **Step 2: Criar `web/components/vida-mapa-leaflet.tsx`**

```tsx
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
```

- [ ] **Step 3: CSS dos pins e do popup no fim de `web/app/globals.css`**

```css
/* ── pins do "céu no mapa" (leaflet divIcon) ────────────────────────────── */
.map-pin {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  background: var(--color-card-2);
  border: 2px solid var(--color-line);
  font-size: 1rem;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.5);
}
.map-pin-sun {
  background: color-mix(in oklab, var(--color-gold) 35%, var(--color-card-2));
  border-color: var(--color-gold-hi);
  font-size: 1.3rem;
}

/* popup do leaflet no tema da página */
.leaflet-popup-content-wrapper,
.leaflet-popup-tip {
  background: var(--color-card-2);
  color: var(--color-ink);
  border: 1px solid var(--color-line);
}
.leaflet-popup-content {
  margin: 10px 14px;
}
.leaflet-container a.leaflet-popup-close-button {
  color: var(--color-mute);
}
```

- [ ] **Step 4: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: sem erros (o componente ainda não é usado — a verificação visual vem na Task 3).

---

### Task 3: Wrapper `vida-mapa.tsx` + integração no `page-shell.tsx`

**Files:**
- Create: `web/components/vida-mapa.tsx`
- Modify: `web/components/page-shell.tsx`

**Interfaces:**
- Consumes: `VidaMapaLeaflet` (Task 2); endpoint `/api/apartments/[id]/map` (Task 1); evento global `sophia:changed` (disparado pelo `LifeBoard.load()` em `web/components/life-board.tsx:61`).
- Produces: `VidaMapa({ apartmentId }: { apartmentId: string })` — export nomeado, usado no `PageShell`.

- [ ] **Step 1: Criar `web/components/vida-mapa.tsx`**

```tsx
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { MapData } from "@/lib/types";

// Leaflet não roda em SSR — o miolo entra só no cliente (ssr: false exige
// estar dentro de um client component; por isso o dynamic vive aqui).
const VidaMapaLeaflet = dynamic(
  () => import("@/components/vida-mapa-leaflet").then((m) => m.VidaMapaLeaflet),
  { ssr: false },
);

/* ── O céu no mapa — o sol + as escolhas, no espaço. ─────────────────────────
   Recarrega quando qualquer seção grava algo (evento sophia:changed, mesmo
   padrão do GastosResumo) e no focus. key={apartment.id} remonta o Leaflet ao
   trocar de residência (re-enquadra); trocar uma seleção só atualiza os pins,
   sem roubar o zoom do usuário. */
export function VidaMapa({ apartmentId }: { apartmentId: string }) {
  const [data, setData] = useState<MapData | null>(null);

  const load = useCallback(() => {
    fetch(`/api/apartments/${apartmentId}/map`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, [apartmentId]);

  useEffect(() => {
    load();
    window.addEventListener("sophia:changed", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("sophia:changed", load);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  // sem geocode ainda = residência não medida; o RouterNotice do quadro conduz
  if (!data || data.apartment.lat == null || data.apartment.lng == null) return null;

  return (
    <section className="mt-10 w-full rounded-2xl border border-line bg-card p-6">
      <p className="microlabel text-gold-hi">o céu no mapa</p>
      <h2 className="mt-3 font-display text-xl font-semibold">
        Tudo em volta de {data.apartment.name}
      </h2>
      <p className="mt-1 text-sm text-mute">
        O sol e as suas escolhas — clique num pin para ver o que é e a distância.
      </p>
      <div className="mt-4 h-[440px] overflow-hidden rounded-xl border border-line">
        <VidaMapaLeaflet key={data.apartment.id} data={data} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Integrar no `web/components/page-shell.tsx`**

Adicionar o import:

```tsx
import { VidaMapa } from "@/components/vida-mapa";
```

E, logo após o `<div className="mt-10">` do LifeBoard (linha ~36), o mapa:

```tsx
      <div className="mt-10">
        <LifeBoard apartment={apartment} />
      </div>

      {apartment && <VidaMapa apartmentId={apartment.id} />}
```

(O `mt-10` do espaçamento já está no `<section>` do próprio `VidaMapa`.)

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Verificação visual (Playwright, de dentro de `web/`)**

Com o dev server rodando, script no scratchpad usando `playwright-core` com `channel: "chrome"` (padrão da memória do projeto):

```js
// verify-mapa.mjs — rodar com: node verify-mapa.mjs (de dentro de web/)
import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 2200 } });
await page.goto("http://localhost:3100/r/0cf217aa-dd85-476b-8085-d68d7c525359");
await page.waitForSelector(".leaflet-container", { timeout: 15000 });
await page.waitForTimeout(2500); // tiles
const pins = await page.locator(".map-pin").count();
console.log("pins no mapa:", pins); // esperado: 15 (1 sol + 4 seleções + 1 campus + 2 gares + 7 hubs)
await page.locator(".map-pin").nth(1).click();
await page.waitForSelector(".leaflet-popup-content");
console.log("popup:", await page.locator(".leaflet-popup-content").innerText());
await page.screenshot({ path: "/tmp/mapa.png", fullPage: true });
await browser.close();
```

Expected: `pins no mapa: 15`; popup com nome, label da categoria e "X min a pé · Y min de carro"; screenshot mostra o mapa escuro embaixo do quadro, sol dourado no meio das escolhas.

---

### Task 4: Verificação end-to-end dos fluxos dinâmicos

**Files:** nenhum (só verificação).

**Interfaces:**
- Consumes: tudo das Tasks 1–3.

- [ ] **Step 1: Trocar uma seleção e ver o pin trocar sem F5**

No browser (Playwright ou manual): abrir `/r/0cf217aa-…` (Dominique), abrir a seção Academia, marcar OUTRA academia como "esta é a minha", fechar a seção. Expected: o pin 🏋️ do mapa muda de lugar sem recarregar a página (evento `sophia:changed`) e o zoom do usuário não é resetado.

- [ ] **Step 2: Trocar de residência e ver o mapa re-enquadrar**

Pelo menu ⋯, abrir outra residência geocodada (ex.: Serge `5673b3e2-02df-45b2-a702-4b3c1d5e1e5f`). Expected: o mapa remonta (key muda), re-enquadra na nova residência e os pins de seleção são OS DELA (Serge tem 3 seleções → 1 sol + 3 seleções + 10 fixos = 14 pins).

- [ ] **Step 3: Home sem residência**

Abrir `http://localhost:3100/`. Expected: nenhum mapa (o `PageShell` só renderiza `VidaMapa` com residência aberta).

- [ ] **Step 4: Desfazer qualquer mudança de seleção feita no Step 1**

Voltar a seleção da academia do Dominique ao estado original (marcar a academia que estava selecionada antes).
