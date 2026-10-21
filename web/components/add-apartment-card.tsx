"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Phase =
  | { kind: "form" }
  | { kind: "sending" }
  | { kind: "done"; id: string; name: string; address: string }
  | { kind: "error"; message: string };

/** Card de entrada do app: o endereço da residência que o Gabriel está olhando.
 *  Só grava o apê (routes_stale=true); distâncias e custos vêm nas próximas partes. */
export function AddApartmentCard() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [rent, setRent] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPhase({ kind: "sending" });
    try {
      const res = await fetch("/api/apartments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(rent.trim() ? { rent_base_eur: Number(rent) } : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setPhase({ kind: "error", message: `Este endereço já existe no céu: ${data.apartment.name}.` });
        return;
      }
      if (!res.ok) {
        setPhase({ kind: "error", message: "Não consegui gravar — confira o endereço." });
        return;
      }
      setPhase({ kind: "done", id: data.id, name: data.name, address: data.address });
    } catch {
      setPhase({ kind: "error", message: "Sem conexão com o servidor." });
    }
  }

  function reset() {
    setAddress("");
    setName("");
    setRent("");
    setPhase({ kind: "form" });
  }

  if (phase.kind === "done") {
    return (
      <section className="w-full rounded-2xl border border-line bg-card p-6">
        <p className="microlabel text-gold-hi">residência cadastrada</p>
        <h2 className="mt-3 font-display text-xl font-semibold">{phase.name}</h2>
        <p className="mt-1 text-sm text-ink-2">{phase.address}</p>
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => router.push(`/r/${phase.id}`)}
            className="w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-sky transition-colors hover:bg-gold-hi"
          >
            Abrir residência
          </button>
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-lg border border-line bg-card-2 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-gold/60"
          >
            Cadastrar outra
          </button>
        </div>
      </section>
    );
  }

  const sending = phase.kind === "sending";

  return (
    <section className="w-full rounded-2xl border border-line bg-card p-6">
      <p className="microlabel text-gold-hi">nova residência</p>
      <h2 className="mt-3 font-display text-xl font-semibold">Comece pelo endereço</h2>
      <p className="mt-1 text-sm text-mute">
        É dele que nascem as distâncias de tudo e o custo desta vida.
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="address" className="microlabel text-ink-2">
            endereço *
          </label>
          <input
            id="address"
            required
            minLength={5}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="920 Boulevard de la Croisette, 06160 Antibes"
            className="mt-1.5 w-full rounded-lg border border-line bg-sky px-3 py-2.5 text-sm text-ink placeholder:text-mute/60 outline-none transition-colors focus:border-gold"
          />
        </div>

        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div>
            <label htmlFor="name" className="microlabel text-ink-2">
              apelido
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Résidence …"
              className="mt-1.5 w-full rounded-lg border border-line bg-sky px-3 py-2.5 text-sm text-ink placeholder:text-mute/60 outline-none transition-colors focus:border-gold"
            />
          </div>
          <div>
            <label htmlFor="rent" className="microlabel text-ink-2">
              aluguel €
            </label>
            <input
              id="rent"
              type="number"
              min={0}
              step="1"
              value={rent}
              onChange={(e) => setRent(e.target.value)}
              placeholder="720"
              className="mt-1.5 w-full rounded-lg border border-line bg-sky px-3 py-2.5 text-sm text-ink placeholder:text-mute/60 outline-none transition-colors focus:border-gold"
            />
          </div>
        </div>

        {phase.kind === "error" && (
          <p role="alert" className="text-sm text-bad">
            {phase.message}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-sky transition-colors hover:bg-gold-hi disabled:opacity-60"
        >
          {sending ? "Gravando…" : "Cadastrar residência"}
        </button>
      </form>
    </section>
  );
}
