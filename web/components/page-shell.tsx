import { AddApartmentCard } from "@/components/add-apartment-card";
import { LifeBoard } from "@/components/life-board";
import { ResidencesMenu } from "@/components/residences-menu";
import { GastosResumo } from "@/components/gastos-resumo";
import { VidaMapa } from "@/components/vida-mapa";

interface ShellApartment {
  id: string;
  name: string;
  address: string | null;
}

/** Layout compartilhado entre a home (sem residência) e /r/[id] (residência aberta):
 *  header à esquerda; à direita o menu ⋯ (residências salvas) sobre o card de
 *  cadastro; embaixo o quadro da vida na largura inteira. */
export function PageShell({ apartment }: { apartment: ShellApartment | null }) {
  return (
    <main className="w-full px-6 py-12 lg:px-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <header className="lg:pt-8">
            <p className="microlabel text-mute">sophia antipolis · 2026–2027</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">O céu de Sophia</h1>
            <p className="mt-1 text-sm text-ink-2">A moradia é o sol; a vida orbita em volta dela.</p>
          </header>
          {apartment && <GastosResumo apartmentId={apartment.id} />}
        </div>

        <div className="flex w-full flex-col gap-2 lg:max-w-md">
          <ResidencesMenu currentId={apartment?.id ?? null} />
          <AddApartmentCard />
        </div>
      </div>

      <div className="mt-10">
        <LifeBoard apartment={apartment} />
      </div>

      {apartment && <VidaMapa apartmentId={apartment.id} />}
    </main>
  );
}
