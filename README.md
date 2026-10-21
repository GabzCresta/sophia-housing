# Housing Decision Platform — Base de Dados

Base PostgreSQL para comparar moradias para o meu intercâmbio na **SKEMA Sophia
Antipolis** (set/2026, região de Antibes/Nice). O conceito central é
**"moradia = sol"**: eu escolho **um** apartamento por vez e todos os outros
pilares da vida (estudo, mercado, academia, fé, mobilidade, viagens) são
calculados **em relação a ele**, com dados reais do Google Maps. Trocar de
apartamento recalcula tudo — distâncias, tempos e o custo de vida mensal.

> Escopo desta entrega: **só o banco de dados**. Sem UI, sem router, sem popular
> dados (exceto 1 apê de exemplo para testes). O **SQL é a fonte da verdade**;
> `schema.prisma` é um espelho opcional.

---

## O modelo "sol / planetas"

```
                        supermercado ·  padaria ·  restaurante ·  bar
                              \            |            /
        academia ── ── ──      \           |           /      ── ── ── igreja
                          \      \    ┌───────────┐    /      /
                           \  ── ─┤   APARTAMENTO  ├─ ── ─  /
        biblioteca ── ── ──       │   (o SOL/LAR)  │        ── ── campus SKEMA
                           /  ── ─┤                ├─ ── ─  \
                          /      /    └───────────┘    \      \
      ponto de ônibus ── /      /           |           \      \── ── gare / A8
                              /             |             \
                        posto ·  aeroporto NCE ·  destinos (Cannes, Monaco…)
```

- **`apartments`** é o **sol/LAR** — o centro de gravidade.
- **`places`** são os **planetas** — *todos* os pontos geográficos da vida.
- **`routes`** é a **gravidade** — uma linha por `(apartamento, lugar, modo)`
  com distância/tempo/custo reais. É o que faz "trocar o sol" recalcular tudo.

**"X mais próximo do apê A"** nunca é uma coluna; é sempre uma query:

```sql
select * from places p
join routes r on r.place_id = p.id
where r.apartment_id = 'A' and p.category = 'supermarket'
order by r.duration_s asc
limit 1;
```

(ou direto pela view `v_apartment_nearest`, que já entrega o mais próximo por categoria).

---

## As 3 naturezas (o que muda quando troco de apê)

O design inteiro gira em torno de classificar cada custo/ponto por **quanto ele
depende da moradia**:

| Natureza | O que é | Muda com o apê? | Onde vive |
|---|---|---|---|
| **1 · Fixo absoluto** | IA, carro, transporte, preço do litro | ❌ Nada muda | `ai_subscriptions`, `car_config`, `transit_config`, `settings` |
| **2 · Ponto fixo, custo varia** | Estudos (campus), Viagens (hubs/destinos) | 🟡 O ponto é o mesmo, mas a **distância/custo** varia | `places` (fixos) + `routes` |
| **3 · Ponto e relação variam** | Supermercado, Restaurante, Academia, Fé, ônibus/gare | 🔴 Até **"o mais próximo" muda** | `places` + `routes` + queries "nearest" |

Trocar de apê = escrever/ler outro `apartment_id`. Natureza 1 nem se mexe;
naturezas 2 e 3 recalculam via `routes` e views.

---

## Regra de ouro: `[auto]` vira VIEW, não coluna

O spec marca campos como `[auto]` (derivados) ou `[manual]` (eu preencho). A regra
aplicada foi:

- **`[auto]` e calculável** a partir de `routes`/`places`/`settings`/fórmula →
  **NÃO é coluna**, é derivado numa **VIEW**. Assim nunca fica desatualizado.
- **`[auto]` mas NÃO calculável** com os dados que temos (ex.: `coworking_count`,
  onde coworking pode não estar mapeado) → fica como coluna manual, comentada.
- **`[manual]`/descritivo** → coluna normal.

Por isso `mobility_profile` **não tem** `nearest_gare_min`/`distance_a8_min` como
colunas: elas vivem em `v_mobility_derived`.

---

## Tabelas

### Núcleo
| Tabela | Papel |
|---|---|
| `apartments` | O **LAR/sol**. Identificação, custo cru, unidade, prédio, contrato, avaliação. |
| `places` | Base de **todos** os pontos geográficos (categoria + geo + Google Place). |
| `routes` | **Tabela-chave**: `(apê, lugar, modo)` → distância/tempo/combustível. |

### Detalhes 1:1 de `places` (por categoria)
`supermarket_details` · `restaurant_details` · `gym_details` · `church_details` ·
`travel_hub_details`. Categorias sem atributos extras (`bakery`, `bar`,
`bus_stop`, `gare`, `gas_station`, `coworking`, `library`, `campus`) usam só `places`.

### Perfis 1:1 do apê (descritivo/manual)
`mobility_profile` · `study_profile` · `apartment_area_stats`.

### Configuração de custo (natureza 1)
`ai_subscriptions` · `car_config` · `transit_config` · `food_profile` ·
`travel_config` · `class_schedule` · `settings`.

### Views (campos `[auto]`)
| View | Entrega |
|---|---|
| `v_apartment_costs` | `rent_total`, `entry_cost`, `effective_cost` (bloco B do apê). |
| `v_apartment_nearest` | O place mais próximo por `(apê, categoria)`. |
| `v_apartment_supermarket` | O **discount** mais próximo (base do custo de comida). |
| `v_mobility_derived` | `nearest_bus_stop_min`, `nearest_gare_*`, `nearest_gas_station_min`, `distance_a8_min`. |
| `v_study_access` | `nearest_library_min`, `campus_library_min`. |
| `v_restaurant_meal_cost` | Custo de uma refeição (default por `price_level`, sobrescrevível). |
| `v_car_cost` | Custo mensal fixo do carro por cenário (deprecia no cenário "comprar"). |
| `v_apartment_cost_of_living` | **Custo de vida mensal total**, componente a componente. |

---

## `v_apartment_cost_of_living` — cada € rastreável

Sem número mágico: cada linha diz de onde vem o dinheiro.

```
total_month = rent_effective            (aluguel CC − APL, do próprio apê)
            + food                      (food_profile × price_index do discount mais próximo)
            + fuel_campus               (combustível rota→campus × 2 × dias de campus/mês)
            + car_fixed                 (custo fixo do carro do cenário ativo)
            + ai                        (soma das assinaturas de IA)
            + transit                   (passe de transporte)
```

- `dias de campus/mês` = dias distintos em `class_schedule` × 4.33 (52/12 semanas),
  com fallback para `study_profile.campus_days_per_week`.
- `active_car_scenario` (em `settings`) escolhe qual cenário de `car_config` conta.
- Preço do litro e consumo vivem em `settings` (a fórmula é auditável).

---

## Como rodar

Precisa de um PostgreSQL (≥ 13, por causa de `gen_random_uuid()`).

```bash
# opção A — migrations em ordem (recomendado)
for f in migrations/0*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done

# opção B — schema consolidado (sem seed) + seed separado
psql "$DATABASE_URL" -f schema.sql
psql "$DATABASE_URL" -f migrations/008_seed_example.sql
```

- Todas as migrations são **idempotentes** (podem rodar de novo sem erro).
- `008` insere as chaves de `settings` (config) + **1 apê de exemplo**
  (Résidence Graziella, 19 Av. Maréchal Joffre, 06160 Antibes) para testar as views.
- Verificado em `postgres:16-alpine`: aplica limpo, roda 2× sem erro, e as views
  respondem mesmo com o banco vazio.

---

## Convenções

- `snake_case`; PK `uuid default gen_random_uuid()`.
- `created_at`/`updated_at` em toda tabela (trigger `set_updated_at()` no UPDATE).
- FKs com `ON DELETE CASCADE` (apagar um apê leva junto suas rotas/perfis; apagar
  um place leva seus detalhes/rotas).
- Índices em todas as FKs e nos campos de busca (status, cidade, categoria, geo…).
- Enums nativos do PostgreSQL (idempotentes via bloco `DO ... EXCEPTION`).

---

## Decisões de design (onde o spec tinha tensão)

1. **Categoria de `places` estendida.** O spec listou 7 categorias de exemplo, mas
   o modelo conceitual exige que ônibus/gare (natureza 3) e "posto/padaria mais
   próximo" funcionem via `routes` — logo, precisam ser `places`. Adicionei:
   `bakery`, `bar`, `bus_stop`, `gare`, `gas_station`, `coworking`. Com isso o
   modelo sol/planetas fica **100% consistente**: todo ponto geográfico é um place.
2. **`[auto]` → view, não coluna** (regra de ouro acima). Evita colunas defasadas
   e duplicação do que já vive em `routes`.
3. **`active_car_scenario` em `settings`** em vez de um flag `is_active` em
   `car_config` — permite ter vários cenários (aluguel/leasing/comprar) para
   comparar e escolher qual entra no custo de vida, sem alterar o schema pedido.
4. **`car_config.fuel_month_eur` fica como cache**, mas `v_car_cost` **não o soma**:
   o combustível casa↔campus é recalculado de `routes` no custo de vida, para não
   contar em dobro.
5. **`coworking_count_10min` / `bars_10min_walk` / `nightlife_dist_min`** ficaram
   como colunas (não views) porque nem sempre são calculáveis (coworking/bar podem
   não estar mapeados como place em toda zona) — são cache que o app preenche.
```

---

# Router — motor de rotas (Google Maps)

`scripts/router.js` popula `places` + `routes` com dados reais. É o que dá vida ao
modelo: geocodifica o apê, descobre os pontos ao redor e mede distância/tempo/custo.

## Como rodar

```bash
npm install                 # instala 'pg'
cp .env.example .env        # preencha GOOGLE_MAPS_API_KEY e DATABASE_URL

node scripts/router.js                      # todos os apartamentos
node scripts/router.js --apartment=<uuid>   # só um
node scripts/router.js --force              # ignora o cache e recalcula tudo
# atalhos: npm run router  /  npm run router:force
```

Ordem por apartamento:
1. **Geocoding** do `address` → grava `lat/lng/city/neighborhood` (pula se já tem coords).
2. **Descoberta** (Places API New) das categorias de vizinhança + garante os places fixos.
3. **Rotas** (Distance Matrix) nos modos relevantes → grava em `routes` com `fuel_cost_eur`.

## Modos por categoria
- **Vizinhança** (mercado, padaria, restaurante, bar, academia, igreja, biblioteca,
  posto, ponto de ônibus, coworking): `driving` + `walking`.
- **Campus / hubs de viagem**: `driving` + `transit`.
- `transit` usa `departure_time` = próxima **segunda 08:00** (config `transit_departure_time`).

## Configuração (`config/*.json` + `settings`)
| Arquivo | O que faz |
|---|---|
| `config/categories.json` | Categorias buscadas "nearby"/"text": tipo do Google, raio e modos. |
| `config/fixed_places.json` | Pontos fixos (campus, aeroporto NCE, A8, gares, destinos) com lat/lng. |
| `config/chains.json` | Rede de supermercado → `is_discount` + `price_index` + `market_type`. |

Chaves em `settings` (a fórmula lê daqui; criadas com default se faltarem):
`fuel_price_eur_per_l`, `car_consumption_l_per_100km`, `transit_departure_time`,
`nearby_radius_m`, `max_results_per_category`.

## Cache e idempotência
- **Rota fresca** (`computed_at` < 30 dias) não é recalculada. Se o apê já tem rotas
  frescas, o router **pula até a descoberta** (não gasta cota). `--force` ignora o cache.
- Places são upsert por `google_place_id` (fixos usam `fixed:<key>`) → rodar 2× **não duplica**.
- `fuel_cost_eur` é de **uma perna (ida)**; o ida+volta é aplicado nas views (×2).
- O log final mostra chamadas por API, cache hits e **custo estimado** em US$.

## Segredos
A chave é lida **sempre** de `process.env.GOOGLE_MAPS_API_KEY`. Nunca fica no código
nem nos `config/*.json`. O `.env` está no `.gitignore`.

## Limitação conhecida
- `bus_stop`: o tipo `bus_station` do Places New retorna poucos/nenhum ponto em Antibes
  (pontos de ônibus locais costumam não ser POIs). A mobilidade segue coberta por
  `nearest_gare` + o campo manual `envibus_lines`. Para cobrir pontos de ônibus, troque
  por busca de texto ("arrêt de bus") em `categories.json`.

## Validação feita (apê de exemplo — Résidence Graziella)
Rodado 1× ao vivo: geocoding OK (Antibes), **85 places** novos, **158 rotas**
(driving/walking/transit), 0 erros, ~US$1,2. Re-run sem `--force`: **0 chamadas, US$0**
(cache). O `v_apartment_cost_of_living` passou a somar o combustível real até o campus
(**786,50 €/mês** com a config de custo ainda parcial).

---

# add-apartment — cadastrar apê a partir do texto do anúncio

`scripts/add-apartment.js` é o fluxo de cadastro com humano no loop: colo o texto de um
anúncio (francês), ele extrai os campos, **pausa para eu confirmar o endereço**, insere e
dispara o router — reusando `runRouter()`/`openClient()` do router.js.

## Como rodar
```bash
node scripts/add-apartment.js anuncio.txt   # anúncio de um arquivo
pbpaste | node scripts/add-apartment.js      # anúncio colado (stdin)
# --force repassa ao router
```

## Fluxo
1. **Extração** heurística (regex, textos em francês) dos campos do pilar Lar.
   **Nunca inventa**: campo sem sinal claro → NULL. Subjetivos (brightness/noise) e APL ficam NULL.
2. **CHECKPOINT bloqueante** no endereço, *antes* de qualquer chamada à Google:
   mostra endereço + resumo (aluguel/tipo/m²/quarto) e pergunta `[s/n/editar]`.
   `n`/vazio → aborta sem inserir e sem gastar; `editar` → digito o endereço certo; `s` → segue.
   Nunca assume "s". Endereço errado contaminaria todas as distâncias — por isso o checkpoint.
3. **Inserção** só após confirmação → retorna o uuid.
4. **Router** roda nesse apê (respeita o cache).
5. **Resumo final**: uuid, geocode, nº places/rotas, mais-próximos e o custo de vida da view.

## Idempotência
- Mesmo `listing_url` já cadastrado → avisa e pergunta se **atualiza** (`coalesce`, não apaga o
  que foi preenchido à mão); `n` → aborta sem duplicar.
- A extração é heurística — sempre revise no checkpoint; os campos NULL você completa depois.

> Nota: o combustível→campus (e o custo completo) precisa dos dias de campus/mês. Isso vem de
> `class_schedule` (grade global) ou de `study_profile.campus_days_per_week` do apê. Sem nenhum
> dos dois, esse componente fica 0 (correto). A grade real (seg/qua/qui) já está em
> `class_schedule`, então novos apês já saem com o combustível calculado.
