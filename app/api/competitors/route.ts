import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, format, isWeekend, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

export async function GET() {
  try {
    const listing = await prisma.listing.findFirst();
    if (!listing) {
      return NextResponse.json({ error: "No listing" }, { status: 404 });
    }

    const today = startOfDay(new Date());
    const competitors = await prisma.competitor.findMany({
      where: { listingId: listing.id },
      include: {
        prices: {
          where: {
            date: { gte: today, lte: addDays(today, 30) },
          },
          orderBy: { date: "asc" },
        },
      },
      orderBy: { rating: "desc" },
    });

    // Build competitor rows with price aggregations
    const rows = competitors.map((comp) => {
      const prices = comp.prices;
      const todayPrice = prices.find(
        (p) => p.date.getTime() >= today.getTime() && p.date.getTime() < today.getTime() + 86400000
      );

      // Find next weekend price
      let weekendPrice = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(today, i);
        if (isWeekend(d)) {
          const wp = prices.find(
            (p) => p.date.getTime() >= d.getTime() && p.date.getTime() < d.getTime() + 86400000
          );
          if (wp) { weekendPrice = wp.price; break; }
        }
      }

      // Find highest price (event/24h du Mans proxy)
      const maxPrice = prices.length > 0
        ? Math.max(...prices.map((p) => p.price))
        : 0;

      const priceTonight = todayPrice?.price || (prices[0]?.price || 0);
      const diffPercent = listing.basePrice > 0 && priceTonight > 0
        ? Math.round(((priceTonight - listing.basePrice) / listing.basePrice) * 100)
        : 0;

      return {
        id: comp.id,
        name: comp.name,
        source: comp.source,
        rating: comp.rating || 0,
        reviewCount: comp.reviewCount || 0,
        priceTonight,
        priceWeekend: weekendPrice || priceTonight,
        price24h: maxPrice || priceTonight,
        diffPercent,
        externalUrl: comp.externalUrl,
      };
    });

    // Build comparison chart data (30 days)
    const comparisonChart = [];
    for (let i = 0; i < 30; i++) {
      const date = addDays(today, i);
      const dayPrices = competitors
        .flatMap((c) =>
          c.prices.filter(
            (p) => p.date.getTime() >= date.getTime() && p.date.getTime() < date.getTime() + 86400000
          )
        )
        .map((p) => p.price)
        .filter((p) => p > 0);

      const avgCompetitor =
        dayPrices.length > 0
          ? Math.round(dayPrices.reduce((s, p) => s + p, 0) / dayPrices.length)
          : 0;

      comparisonChart.push({
        date: format(date, "dd/MM", { locale: fr }),
        myPrice: listing.basePrice,
        avgCompetitor,
      });
    }

    return NextResponse.json({
      competitors: rows,
      comparisonChart: comparisonChart.filter((d) => d.avgCompetitor > 0),
      myPrice: listing.basePrice,
    });
  } catch (error) {
    console.error("Competitors API error:", error);
    return NextResponse.json(
      { error: "Erreur chargement concurrents" },
      { status: 500 }
    );
  }
}
