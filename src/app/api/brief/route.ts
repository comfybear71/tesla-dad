import { NextResponse } from "next/server";
import { getDailyBrief, saveDailyBrief } from "@/lib/store";
import { generateDailyBrief } from "@/lib/brief";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // brief generation calls the Claude API

export async function GET() {
  const brief = await getDailyBrief();
  if (!brief) {
    return NextResponse.json(
      {
        error: "No brief yet.",
        hint: process.env.ANTHROPIC_API_KEY
          ? "The first brief is generated automatically on the first cron run after the US market opens."
          : "Add ANTHROPIC_API_KEY in Vercel to enable the AI daily brief.",
      },
      { status: 404 },
    );
  }
  return NextResponse.json(brief);
}

/** Regenerate the brief on demand (owner-triggered from the News page). */
export async function POST() {
  try {
    const brief = await generateDailyBrief();
    await saveDailyBrief(brief);
    return NextResponse.json(brief);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
}
