# Design — Dropdown de todas as igrejas no card "Fé"

**Data:** 2026-07-09
**Contexto:** Housing Decision Platform (SKEMA Sophia Antipolis) — front em `web/` (Next.js 16 + Turbopack).

## Problema

O card do pilar **Fé** (`web/lib/pillars.ts`, pilar `key: "fe"`) mostra apenas a igreja **mais perto**, porque lê de
`overview.nearest`, cuja fonte é a view `v_apartment_nearest` — que faz
`distinct on (category) ... order by duration` e, por construção, devolve 1 lugar por categoria.

O usuário quer **visualizar todas as igrejas** que o `router.js` já encontrou para o apê (as rotas
já estão gravadas na tabela `routes` + `places` com `category='church'`), não só a mais perto.

## Escopo (YAGNI)

- Só o pilar **Fé**. Não generalizar para os outros pilares agora.
- Não alterar a view `v_apartment_nearest` nem rodar o `router.js`.
- Só **expor** dados já existentes no banco + trocar a UI do card Fé.

## Solução

### 1. API — `GET /api/apartments/[id]/churches`

Nova rota que pivota os modos (`walking`/`driving`) da tabela `routes`, uma linha por igreja:

```sql
select
  p.id, p.name,
  max(r.distance_m) filter (where r.mode = 'walking')  as walk_m,
  max(r.duration_s) filter (where r.mode = 'walking')  as walk_s,
  max(r.distance_m) filter (where r.mode = 'driving')  as drive_m,
  max(r.duration_s) filter (where r.mode = 'driving')  as drive_s
from routes r
join places p on p.id = r.place_id and p.category = 'church'
where r.apartment_id = $1
group by p.id, p.name
order by walk_s nulls last, p.name;
```

Resposta (`ChurchPlace[]`), com minutos já arredondados na borda do banco:

```json
[ { "id": "...", "name": "Église Notre-Dame de la Pinède d'Antibes",
    "walkMin": 8, "walkM": 537, "driveMin": 2, "driveM": 647 }, ... ]
```

`driveMin`/`driveM` podem vir `null` quando uma igreja só tem rota a pé no banco (na Graziella todas as
10 têm os dois modos; o tratamento de `null` fica como defesa para outros apês). Ordenado pela mais perto a pé.

### 2. Tipo — `web/lib/types.ts`

```ts
export interface ChurchPlace {
  id: string;
  name: string;
  walkMin: number | null; walkM: number | null;
  driveMin: number | null; driveM: number | null;
}
```

### 3. Hook — `web/lib/queries.ts`

`useChurches(id)` (react-query, `enabled: !!id`), no mesmo padrão de `useOverview`.

### 4. UI — `web/components/faith-pillar.tsx` (novo)

- Reproduz a **casca visual** do card de pilar (borda, chip do ícone `Church`, accent violet, label "Fé"),
  idêntica aos demais cards de `PillarsOverview`.
- `<Select>` (base-ui, `web/components/ui/select.tsx`) com todas as igrejas; **default = a primeira** (mais perto).
- Ao trocar, o card mostra os detalhes da igreja selecionada:
  - linha principal: nome da igreja;
  - `a pé 8 min · carro 2 min` (omite o trecho "carro" quando `driveMin` é `null`);
  - `537 m` (distância a pé, via helper `dist()`).
- Estado local da seleção; **reseta para a mais perto** quando o `apartmentId` muda (via `key`/reset).
- Estados: loading (skeleton), erro, e "—" quando não há igreja no raio.

### 5. Integração — `web/components/pillars-overview.tsx`

No `.map` dos pilares, quando `p.key === 'fe'`, renderiza `<FaithPillar apartmentId={...} />` no lugar
do card genérico — mantendo a posição do card (6º) no grid.

## Verificação (real)

1. `curl /api/apartments/<graziella>/churches` → confere as 10 igrejas com os dois tempos.
2. Browser em `localhost:3100`: abrir o dropdown do card Fé, trocar a igreja e confirmar que
   nome/tempo/distância mudam; trocar o "sol" e confirmar que a seleção reseta para a mais perto.

## Edge cases

- Igreja sem `driving` → mostra só "a pé X min".
- Apê sem igreja com rota → "—".
- Trocar o "sol" durante uma seleção → volta para a mais perto do novo apê.
