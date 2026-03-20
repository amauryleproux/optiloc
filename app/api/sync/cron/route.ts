import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const job = searchParams.get("job");

  try {
    switch (job) {
      case "ical": {
        const res = await fetch(
          new URL("/api/sync/ical", request.url).toString(),
          { method: "POST" }
        );
        const data = await res.json();
        return NextResponse.json({ job: "ical", ...data });
      }

      case "competitors": {
        const res = await fetch(
          new URL("/api/competitors/scrape", request.url).toString(),
          { method: "POST" }
        );
        const data = await res.json();
        return NextResponse.json({ job: "competitors", ...data });
      }

      case "pricing": {
        const res = await fetch(
          new URL("/api/pricing/recommendations", request.url).toString(),
          { method: "POST" }
        );
        const data = await res.json();
        return NextResponse.json({ job: "pricing", ...data });
      }

      case "listing-score": {
        const res = await fetch(
          new URL("/api/ai/listing-audit", request.url).toString(),
          { method: "POST" }
        );
        const data = await res.json();
        return NextResponse.json({ job: "listing-score", ...data });
      }

      default:
        return NextResponse.json(
          { error: "Job inconnu. Jobs valides : ical, competitors, pricing, listing-score" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Cron job "${job}" error:`, error);
    return NextResponse.json(
      { error: `Échec du job "${job}"` },
      { status: 500 }
    );
  }
}
