import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import { PageShell } from "@/components/page-shell";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** /r/[id] — a página de UMA residência: o mesmo shell, mas o quadro é dela.
 *  Tudo que as seções mostrarem daqui em diante acompanha este id. */
export default async function ResidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const apartment = await queryOne<{ id: string; name: string; address: string | null }>(
    `select id, name, address from apartments where id = $1`,
    [id],
  );
  if (!apartment) notFound();

  return <PageShell apartment={apartment} />;
}
