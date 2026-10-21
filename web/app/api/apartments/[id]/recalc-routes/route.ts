import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { query, queryOne } from "@/lib/db";

// POST /api/apartments/[id]/recalc-routes — dispara o scripts/router.js SÓ para este apê
// (--force), reusando a chave da Google do .env da raiz (o router carrega sozinho).
// Human-in-the-loop: a UI só chama isto após confirmação explícita (bate na Google, tem custo).
export const maxDuration = 300; // recálculo de 1 apê pode levar minutos

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const apt = await queryOne<{ id: string }>(`select id from apartments where id = $1`, [id]);
  if (!apt) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // O dev server roda em web/; o router e o .env vivem na raiz do repo.
  const projectRoot = path.resolve(process.cwd(), "..");

  const result = await new Promise<{ code: number | null; out: string; err: string }>((resolve) => {
    const child = spawn("node", ["scripts/router.js", `--apartment=${id}`, "--force"], {
      cwd: projectRoot,
      env: process.env,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    const timer = setTimeout(() => child.kill("SIGKILL"), 280_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, out, err });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: -1, out, err: e.message });
    });
  });

  if (result.code !== 0) {
    const detail = (result.err || result.out || "").trim().split("\n").slice(-3).join(" ").slice(0, 300);
    return NextResponse.json({ error: "router_falhou", detail }, { status: 500 });
  }

  // Rotas atualizadas → limpa a flag.
  await query(`update apartments set routes_stale = false, updated_at = now() where id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
