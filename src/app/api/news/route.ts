import { NextResponse } from "next/server";
import { resolveSymbol } from "@/lib/store";
import { getCompanyNews } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const symbol = await resolveSymbol(new URL(req.url).searchParams.get("symbol"));
  try {
    const items = await getCompanyNews(symbol);
    return NextResponse.json({ symbol, items });
  } catch (e) {
    // No fabricated headlines: report the missing source honestly.
    return NextResponse.json(
      { error: (e as Error).message, code: "NO_NEWS_SOURCE" },
      { status: 503 },
    );
  }
}
