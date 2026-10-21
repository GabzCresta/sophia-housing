"use client";

import { eur } from "@/lib/format";
import { CHARGES_INCLUDE } from "@/lib/schemas";
import { missingEssentials, routerPending } from "@/lib/moradia";
import { RouterNotice } from "@/components/router-notice";
import {
  AutoTile,
  BoolField,
  ChipsField,
  DateField,
  Group,
  Notice,
  NumberField,
  RatingField,
  SaveIndicator,
  SelectField,
  TextField,
  useAutosave,
} from "@/components/section-ui";
import type { ApartmentFull } from "@/lib/types";

/* ── A ficha da Moradia (grupos A-F) ─────────────────────────────────────────
   Composição sobre o kit de components/section-ui.tsx (o "UI Moradia" que o
   Gabriel aprovou como molde de todas as seções). Origem é propriedade do
   campo: cidade/bairro = router; o resto é humano. Avisos agregados no topo. */

/* ── resumo acionável: o que falta e de quem é a vez ── */

function SummaryBar({
  data,
  apartmentId,
  onSaved,
}: {
  data: ApartmentFull;
  apartmentId: string;
  onSaved: () => void;
}) {
  const missing = missingEssentials(data);
  const pending = routerPending(data);

  if (missing.length === 0 && !pending) {
    return (
      <div className="mt-4">
        <Notice tone="ok">Ficha completa — essenciais preenchidos e router em dia.</Notice>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {missing.length > 0 && (
        <Notice tone="todo">
          <span className="font-medium text-ink">Falta você ({missing.length}):</span>{" "}
          {missing.join(", ")}
        </Notice>
      )}
      {pending && (
        <RouterNotice
          apartmentId={apartmentId}
          message="distâncias e cidade/bairro pendentes"
          onDone={onSaved}
        />
      )}
    </div>
  );
}

/* ── a seção ── */

export function MoradiaSection({
  apartmentId,
  data,
  onSaved,
}: {
  apartmentId: string;
  data: ApartmentFull;
  onSaved: () => void;
}) {
  const { patch, state } = useAutosave(`/api/apartments/${apartmentId}`, onSaved);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-mute">
          Tudo grava sozinho ao sair do campo. Âmbar = falta você; azul = papel do router.
        </p>
        <SaveIndicator state={state} />
      </div>

      <SummaryBar data={data} apartmentId={apartmentId} onSaved={onSaved} />

      {/* os [auto] — a view calcula, ninguém digita */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <AutoTile label="aluguel total /mês" value={eur(data.rent_total_eur)} hint="base + charges (se HC)" />
        <AutoTile label="custo de entrada" value={eur(data.entry_cost_eur)} hint="1º mês + taxa + depósito" />
        <AutoTile label="mensal efetivo" value={eur(data.effective_cost_eur)} hint="aluguel CC − APL" />
      </div>

      <div className="mt-4 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Group title="a · identificação">
          <TextField label="nome / referência" name="name" initial={data.name} patch={patch} />
          <TextField label="endereço" name="address" initial={data.address} patch={patch} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="cidade" name="city" initial={data.city} patch={patch} source="router" routerDone={!data.routes_stale} />
            <TextField label="bairro" name="neighborhood" initial={data.neighborhood} patch={patch} source="router" routerDone={!data.routes_stale} />
          </div>
          <SelectField
            label="status"
            name="status"
            initial={data.status}
            allowNull={false}
            options={[
              ["favorito", "Favorito"],
              ["candidatar", "Candidatar"],
              ["analisando", "Analisando"],
              ["descartado", "Descartado"],
            ]}
            patch={patch}
          />
          <TextField label="fonte (portal)" name="source_portal" initial={data.source_portal} patch={patch} placeholder="Leboncoin, SeLoger…" />
          <TextField label="link do anúncio" name="listing_url" initial={data.listing_url} patch={patch} placeholder="https://…" />
          <TextField
            label="contato (landlord / agência)"
            name="contact_info"
            initial={data.contact_info}
            patch={patch}
            placeholder="nome · telefone · e-mail"
          />
        </Group>

        <Group title="b · custo">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="aluguel base €" name="rent_base_eur" initial={data.rent_base_eur} patch={patch} />
            <NumberField label="charges €" name="charges_eur" initial={data.charges_eur} patch={patch} />
          </div>
          <SelectField
            label="tipo de charges"
            name="charges_type"
            initial={data.charges_type}
            options={[
              ["CC", "CC — charges comprises"],
              ["HC", "HC — hors charges"],
            ]}
            patch={patch}
          />
          <ChipsField
            label="as charges incluem"
            name="charges_include"
            initial={data.charges_include}
            options={CHARGES_INCLUDE.map((c) => [c, c === "agua" ? "água" : c] as const)}
            patch={patch}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="1º mês (à vista) €" name="first_month_eur" initial={data.first_month_eur} patch={patch} />
            <NumberField label="taxa de agência €" name="admin_fee_eur" initial={data.admin_fee_eur} patch={patch} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="depósito / caução €" name="deposit_eur" initial={data.deposit_eur} patch={patch} />
            <NumberField label="APL estimado €" name="apl_estimate_eur" initial={data.apl_estimate_eur} patch={patch} />
          </div>
        </Group>

        <Group title="c · a unidade">
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="tipo"
              name="unit_type"
              initial={data.unit_type}
              options={[
                ["studio", "Studio"],
                ["T1", "T1"],
                ["T2", "T2"],
                ["T3", "T3"],
              ]}
              patch={patch}
            />
            <BoolField label="quarto separado?" name="separate_bedroom" initial={data.separate_bedroom} patch={patch} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="área m²" name="area_m2" initial={data.area_m2} patch={patch} />
            <NumberField label="andar" name="floor" initial={data.floor} patch={patch} step="1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BoolField label="mobiliado" name="furnished" initial={data.furnished} patch={patch} />
            <SelectField
              label="estado"
              name="condition"
              initial={data.condition}
              options={[
                ["novo", "Novo"],
                ["reformado", "Reformado"],
                ["bom", "Bom"],
                ["a_renovar", "A renovar"],
              ]}
              patch={patch}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BoolField label="terraço / varanda" name="terrace" initial={data.terrace} patch={patch} />
            <NumberField label="terraço m²" name="terrace_m2" initial={data.terrace_m2} patch={patch} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="vista"
              name="view"
              initial={data.view}
              options={[
                ["mar", "Mar"],
                ["jardim", "Jardim"],
                ["rua", "Rua"],
                ["patio", "Pátio"],
              ]}
              patch={patch}
            />
            <SelectField
              label="exposição"
              name="exposure"
              initial={data.exposure}
              options={[
                ["N", "Norte"],
                ["S", "Sul"],
                ["L", "Leste"],
                ["O", "Oeste"],
              ]}
              patch={patch}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BoolField label="ar-condicionado" name="air_conditioning" initial={data.air_conditioning} patch={patch} />
            <SelectField
              label="banheiro"
              name="bathroom"
              initial={data.bathroom}
              options={[
                ["banheira", "Banheira"],
                ["chuveiro", "Chuveiro"],
              ]}
              patch={patch}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BoolField label="cozinha equipada" name="equipped_kitchen" initial={data.equipped_kitchen} patch={patch} />
            <BoolField label="lava-louças" name="dishwasher" initial={data.dishwasher} patch={patch} />
          </div>
          <BoolField label="máquina de lavar" name="washing_machine" initial={data.washing_machine} patch={patch} />
          <div className="grid grid-cols-2 gap-3">
            <RatingField label="luminosidade" name="brightness_1_5" initial={data.brightness_1_5} patch={patch} />
            <RatingField label="ruído estimado" name="noise_1_5" initial={data.noise_1_5} patch={patch} />
          </div>
        </Group>

        <Group title="d · o prédio / residência">
          <BoolField label="elevador" name="elevator" initial={data.elevator} patch={patch} />
          <SelectField
            label="segurança"
            name="security"
            initial={data.security}
            options={[
              ["guarda", "Guarda"],
              ["digicode", "Digicode"],
              ["interfone", "Interfone"],
              ["cameras", "Câmeras"],
              ["nenhum", "Nenhum"],
            ]}
            patch={patch}
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="estacionamento"
              name="parking"
              initial={data.parking}
              options={[
                ["box_subsolo", "Box subsolo"],
                ["rua", "Rua"],
                ["nenhum", "Nenhum"],
              ]}
              patch={patch}
            />
            <NumberField label="custo estac. €" name="parking_cost_eur" initial={data.parking_cost_eur} patch={patch} />
          </div>
          <ChipsField
            label="comodidades"
            name="amenities"
            initial={data.amenities}
            options={[
              ["piscina", "piscina"],
              ["tenis", "tênis"],
              ["academia", "academia"],
              ["jardim", "jardim"],
            ]}
            patch={patch}
          />
          <TextField label="estado / ano do prédio" name="building_condition" initial={data.building_condition} patch={patch} />
        </Group>

        <Group title="e · contrato">
          <SelectField
            label="tipo de bail"
            name="lease_type"
            initial={data.lease_type}
            options={[
              ["etudiant", "Étudiant (9–10 meses)"],
              ["mobilite", "Mobilité"],
              ["umano", "1 ano"],
            ]}
            patch={patch}
          />
          <div className="grid grid-cols-2 gap-3">
            <DateField label="disponível de" name="available_from" initial={data.available_from} patch={patch} />
            <DateField label="disponível até" name="available_to" initial={data.available_to} patch={patch} />
          </div>
          <SelectField
            label="garante exigido"
            name="guarantor"
            initial={data.guarantor}
            options={[
              ["visale", "Visale"],
              ["studapart", "Studapart"],
              ["pais", "Pais"],
              ["nenhum", "Nenhum"],
            ]}
            patch={patch}
          />
          <NumberField
            label="renda mínima do garante €"
            name="guarantor_min_income_eur"
            initial={data.guarantor_min_income_eur}
            patch={patch}
          />
          <BoolField label="reservado a estudante" name="student_only" initial={data.student_only} patch={patch} />
          <NumberField
            label="seguro obrigatório € /mês"
            name="mandatory_insurance_eur"
            initial={data.mandatory_insurance_eur}
            patch={patch}
          />
        </Group>

        <Group title="f · avaliação">
          <div className="rounded-lg border border-line bg-sky px-3 py-2.5">
            <p className="microlabel text-mute">nota lar [auto]</p>
            <p className="mt-0.5 text-sm text-mute">— pesos a definir</p>
          </div>
          <TextField label="prós" name="pros" initial={data.pros} patch={patch} rows={3} />
          <TextField label="contras" name="cons" initial={data.cons} patch={patch} rows={3} />
          <TextField label="notas pessoais" name="personal_notes" initial={data.personal_notes} patch={patch} rows={3} />
        </Group>
      </div>
    </div>
  );
}
