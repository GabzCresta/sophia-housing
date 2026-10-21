"use client";

import { ExternalLink } from "lucide-react";
import { RouterNotice } from "@/components/router-notice";
import { Notice } from "@/components/section-ui";
import { googleMapsUrl } from "@/lib/cabeleireiro";
import type { PlaceOption } from "@/lib/types";

/* ── Seção Paki — a mercearia de conveniência de bairro (épicerie, night shop,
   alimentation). Só a lista do router: aqui importa ter uma por perto, não o
   custo. Sem "esta é a minha" e sem budget (pedido dele: só as opções). ─────── */

export function PakiSection({
  apartmentId,
  places,
  onChanged,
}: {
  apartmentId: string;
  places: PlaceOption[];
  onChanged: () => void;
}) {
  if (places.length === 0) {
    return (
      <RouterNotice
        apartmentId={apartmentId}
        message="nenhuma mercearia de bairro medida ainda para este endereço"
        onDone={onChanged}
      />
    );
  }

  return (
    <div>
      <p className="text-sm text-mute">
        As lojinhas de conveniência ao redor (épicerie, night shop, alimentation) — o pão, o leite
        de última hora. Proximidade, não custo.
      </p>

      <div className="mt-4">
        <Notice tone="info">
          <span className="font-medium text-ink">Router achou {places.length} mercearias</span> ·
          tempos e notas do Google
        </Notice>
      </div>

      {/* a lista, do mais perto ao mais longe */}
      <ul className="mt-4 flex flex-col gap-2">
        {places.map((p) => {
          const url = googleMapsUrl(p);
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-card-2 px-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{p.name}</span>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      title="ver no Google Maps"
                      className="inline-flex items-center gap-1 text-xs text-info underline decoration-info/40 underline-offset-2 transition-colors hover:text-gold-hi"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                      ver no Google
                    </a>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-mute">
                  {p.rating != null ? `★ ${String(p.rating).replace(".", ",")}` : "sem nota"}
                </span>
              </span>

              <span className="w-28 shrink-0 text-right text-sm text-ink-2">
                <span className="block">{p.walkMin != null ? `${p.walkMin} min a pé` : "a pé —"}</span>
                <span className="block text-xs text-mute">
                  {p.driveMin != null ? `${p.driveMin} min de carro` : "carro —"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
