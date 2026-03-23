import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEngineFromPrisma } from "@/lib/pricing-engine";
import { addDays, startOfDay } from "date-fns";

export async function GET() {
  try {
    const listing = await prisma.listing.findFirst();
    if (!listing) {
      return NextResponse.json(
        { error: "Aucun logement configuré" },
        { status: 400 }
      );
    }

    // Fetch all data needed by the engine
    const now = new Date();
    const in90 = addDays(now, 90);

    const [bookings, events, competitors, rules] = await Promise.all([
      prisma.booking.findMany({
        where: {
          listingId: listing.id,
          status: "confirmed",
          checkOut: { gte: now },
        },
      }),
      prisma.event.findMany({
        where: {
          OR: [
            { endDate: { gte: now } },
            { startDate: { lte: in90 } },
          ],
        },
      }),
      prisma.competitor.findMany({
        where: { listingId: listing.id },
        include: {
          prices: {
            where: {
              date: { gte: startOfDay(now), lte: in90 },
              available: true,
            },
          },
        },
      }),
      prisma.pricingRule.findMany({
        where: { listingId: listing.id },
        orderBy: { priority: "desc" },
      }),
    ]);

    // Build occupancy map for isBooked flag
    const bookedDates = new Set<string>();
    for (const b of bookings) {
      const checkIn = new Date(b.checkIn);
      const checkOut = new Date(b.checkOut);
      const current = new Date(checkIn);
      while (current < checkOut) {
        bookedDates.add(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }
    }

    // Create engine and generate recommendations
    const engine = createEngineFromPrisma(
      listing,
      bookings,
      events,
      competitors,
      rules
    );

    const recommendations = engine.generateRecommendations(60).map((rec) => ({
      ...rec,
      isBooked: bookedDates.has(rec.date),
    }));

    // Revenue projection
    const occupancyRate30 =
      bookings.filter(
        (b) => b.checkIn <= addDays(now, 30) && b.checkOut >= now
      ).length > 0
        ? Math.min(
            1,
            bookings.reduce((sum, b) => {
              const start = b.checkIn > now ? b.checkIn : now;
              const end =
                b.checkOut < addDays(now, 30) ? b.checkOut : addDays(now, 30);
              const diff = Math.max(
                0,
                (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
              );
              return sum + diff;
            }, 0) / 30
          )
        : 0.5;

    const projection = engine.projectRevenue(60, occupancyRate30);

    // Competitor average for today
    const todayKey = startOfDay(now).toISOString().split("T")[0];
    const todayPrices = competitors.flatMap((c) =>
      c.prices
        .filter(
          (p) =>
            new Date(p.date).toISOString().split("T")[0] === todayKey &&
            p.available
        )
        .map((p) => p.price)
    );
    const competitorAvg =
      todayPrices.length > 0
        ? Math.round(
            todayPrices.reduce((s, p) => s + p, 0) / todayPrices.length
          )
        : 0;

    return NextResponse.json({
      recommendations,
      projection,
      occupancyRate: Math.round(occupancyRate30 * 100),
      competitorAvg,
    });
  } catch (error) {
    console.error("Pricing recommendations error:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des recommandations" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
