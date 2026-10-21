/** Formatação — o pg devolve numeric como string, então tudo passa por Number(). */

const eurFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const eur = (v: unknown) => {
  const n = num(v);
  return n === null ? "—" : eurFmt.format(n);
};

const eurFmt2 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** € com centavos — para valores pequenos (gasolina/mês). */
export const eur2 = (v: unknown) => {
  const n = num(v);
  return n === null ? "—" : eurFmt2.format(n);
};
