import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { searchPlaces } from "@/lib/google-server";

// GET /api/places/search?q=…&apartment=<id> — busca um lugar no Google (server-
// side; a chave não sai do servidor), com viés na localização do apê. Custo
// ~US$0,03 por busca — só roda no clique do botão, nunca por tecla digitada.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const apartmentId = url.searchParams.get("apartment");
  if (q.length < 3) return NextResponse.json({ error: "busca_curta" }, { status: 400 });

  let bias: { lat: number; lng: number } | null = null;
  if (apartmentId) {
    const apt = await queryOne<{ lat: number | null; lng: number | null }>(
      `select lat, lng from apartments where id = $1`,
      [apartmentId],
    );
    if (apt?.lat != null && apt?.lng != null) bias = { lat: Number(apt.lat), lng: Number(apt.lng) };
  }

  try {
    const places = await searchPlaces(q, bias);
    return NextResponse.json(places);
  } catch {
    return NextResponse.json({ error: "google_falhou" }, { status: 502 });
  }
}
