# Design — "O céu no mapa": mapa das seleções embaixo do quadro

**Data:** 2026-07-12
**Contexto:** Housing Decision Platform (SKEMA Sophia Antipolis) — front em `web/` (Next.js 16 + React 19), banco Postgres no Docker (`sophia_pg`, porta 55432).

## Problema

As distâncias hoje são números (min a pé / de carro) espalhados pelas seções. O usuário quer
**ver no espaço**: um mapa embaixo de tudo com a residência aberta (o sol) e as opções que ele
marcou como "esta é a minha" em cada pilar (academia, supermercado, igreja, cabeleireiro…),
cada uma com um pin identificado. O mapa é **por residência** — muda junto com o apê aberto
em `/r/[id]`, nunca estático.

## Decisões já tomadas com o usuário

- **Leaflet + OpenStreetMap** (não Google Maps JS): interativo, zero chave, zero custo.
- Pins: **apartamento (sol) + seleções + campus (SKEMA) + gares + hubs de viagem**.
- **Sem filtro/toggle de categorias** na primeira versão.
- Posição: **abaixo do LifeBoard**, largura inteira.

## Dados disponíveis (verificado no banco em 2026-07-12)

- `apartments.lat/lng` — preenchido pelo router (geocode).
- `places.lat/lng` — 100% preenchido nas 16 categorias (521 places).
- `apartment_selections` — "esta é a minha" por (apê, categoria); genérico, qualquer categoria.
- `routes` — tempos walking/driving por (apê, place), inclusive para campus (1), gare (2) e travel_hub (7).

## Solução

### 1. API — `GET /api/apartments/[id]/map` (nova rota)

Uma resposta com o sol e os pins:

```json
{
  "apartment": { "id": "…", "name": "Graziella", "lat": 43.58, "lng": 7.10 },
  "pins": [
    { "id": "…", "name": "Basic Fit", "category": "gym", "lat": 43.58, "lng": 7.11,
      "walkMin": 12, "driveMin": 4, "selected": true },
    { "id": "…", "name": "SKEMA", "category": "campus", "lat": …, "lng": …,
      "walkMin": 25, "driveMin": 7, "selected": false }
  ]
}
```

Query dos pins (uma só): places com `lat is not null` que **ou** têm seleção do apê
**ou** são categoria fixa (`campus`, `gare`, `travel_hub`); tempos pivotados de `routes`
no padrão já usado em `pillar/[category]/route.ts` (max filter por mode, arredondado
para minutos na borda do banco). `walkMin`/`driveMin` podem ser `null` (sem rota medida).

Se `apartment.lat` é `null` (residência ainda não geocodada), a resposta vem normal e o
**front** decide não renderizar o mapa.

### 2. Tipos — `web/lib/types.ts`

```ts
export interface MapPin {
  id: string; name: string; category: string;
  lat: number; lng: number;
  walkMin: number | null; driveMin: number | null;
  selected: boolean;
}
export interface MapData {
  apartment: { id: string; name: string; lat: number | null; lng: number | null };
  pins: MapPin[];
}
```

### 3. UI — `web/components/vida-mapa.tsx` (novo) + miolo Leaflet

- **Wrapper** (`vida-mapa.tsx`): client component; faz o fetch de `/api/…/map`, escuta o
  evento `sophia:changed` (mesmo padrão do `GastosResumo`) e o `focus` da janela para
  recarregar quando uma seleção muda; carrega o miolo com `next/dynamic` e `ssr: false`
  (Leaflet não roda em SSR). Casca visual no padrão das seções: `rounded-2xl border
  border-line bg-card p-6`, microlabel dourado ("o céu no mapa"), título display.
- **Miolo** (`vida-mapa-leaflet.tsx`): `react-leaflet` v5 (compatível com React 19) +
  `leaflet` 1.9; importa `leaflet/dist/leaflet.css`.
- **Tiles**: CartoDB *Dark Matter* (gratuito, combina com o tema escuro). Trocar depois é 1 linha.
- **Pins**: `divIcon` HTML estilizado (evita o bug clássico do ícone default do Leaflet com
  bundler). Sol = pin maior, dourado, destacado. Cada categoria = círculo com anel na cor
  do tema + **emoji da categoria** como glyph (🏋️ 🛒 ⛪ ✂️ 🎓 🚉 ✈️ …) — zero dependência
  extra e legível sobre o tile escuro. Popup (clique) com JSX:
  **nome · label da categoria · "X min a pé · Y min de carro"** (omite modo sem rota).
- **Enquadramento**: `fitBounds` no sol + seleções + campus + gares, com padding.
  `travel_hub` (aeroporto etc.) **não força o zoom inicial** — ficaria tudo longe demais;
  os hubs aparecem ao dar zoom out.
- **Altura**: ~440px, largura inteira.

### 4. Integração — `web/components/page-shell.tsx`

Abaixo do `LifeBoard`: `{apartment && <VidaMapa apartmentId={apartment.id} />}`.
Sem residência aberta, sem mapa (consistente com o resto do quadro).

### 5. Dependências

`leaflet`, `react-leaflet@^5` (prod) e `@types/leaflet` (dev). Nada de chave/API externa
além dos tiles públicos.

## Edge cases

- Apê sem `lat/lng` → o card do mapa não renderiza o Leaflet; mostra a mensagem padrão de
  residência não medida (o `RouterNotice` do LifeBoard já conduz o fluxo de medição).
- Nenhuma seleção ainda → mapa útil mesmo assim: sol + campus + gares/hubs.
- Pin sem rota medida → popup sem a linha de tempos.
- Pins sobrepostos (ex.: farmácia dentro de shopping) → aceitável nesta versão (YAGNI).

## Verificação (real)

1. `curl localhost:3000/api/apartments/<id>/map` → sol com lat/lng + pins com `selected`,
   categorias fixas presentes, tempos corretos (conferir 1 contra a seção correspondente).
2. Playwright (playwright-core, channel chrome, de dentro de `web/` — ver memória): abrir
   `/r/<id>`, screenshot do mapa, clicar num pin e conferir o popup (nome · categoria · tempos).
3. Marcar outra academia como "esta é a minha" e confirmar que o pin troca sem F5
   (evento `sophia:changed`).
4. Trocar de residência no menu ⋯ e confirmar que o mapa re-enquadra na nova.
