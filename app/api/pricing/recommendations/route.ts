import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRecommendationsForRange } from "@/lib/pricing-engine";
import { subMonths, startOfMonth, startOfDay, addDays } from "date-fns";

export async function GET() {
  try {
    const listing = await prisma.listing.findFirst();
    if (!listing) {
      return NextResponse.json(
        { error: "Aucun logement configuré" },
        { status: 400 }
      );
    }

    const recommendations = await getRecommendationsForRange(listing.id, 60);

    // Historical average price from CSV
    const threeMonthsAgo = startOfMonth(subMonths(new Date(), 3));
    const csvBookings = await prisma.booking.findMany({
      where: {
        listingId: listing.id,
        revenueSource: "csv",
        checkIn: { gte: threeMonthsAgo },
      },
      select: { pricePerNight: true },
    });
    const historicalAvgPrice =
      csvBookings.length > 0
        ? Math.round(
            csvBookings.reduce((s, b) => s + b.pricePerNight, 0) /
              csvBookings.length
          )
        : listing.basePrice;

    // Occupancy rate (next 30 days)
    const now = new Date();
    const in30 = addDays(now, 30);
    const futureBookings = await prisma.booking.findMany({
      where: {
        listingId: listing.id,
        checkIn: { lte: in30 },
        checkOut: { gte: now },
        status: "confirmed",
      },
    });
    let bookedNights = 0;
    for (const b of futureBookings) {
      const start = b.checkIn > now ? b.checkIn : now;
      const end = b.checkOut < in30 ? b.checkOut : in30;
      const { differenceInDays } = await import("date-fns");
      bookedNights += Math.max(0, differenceInDays(end, start));
    }
    const occupancyRate = Math.round((bookedNights / 30) * 100);

    // Competitor average
    const todayPrices = await prisma.competitorPrice.findMany({
      where: {
        date: {
          gte: startOfDay(now),
          lte: addDays(startOfDay(now), 1),
        },
        available: true,
      },
    });
    const competitorAvg =
      todayPrices.length > 0
        ? Math.round(
            todayPrices.reduce((s, p) => s + p.price, 0) / todayPrices.length
          )
        : 0;

    return NextResponse.json({
      recommendations,
      historicalAvgPrice,
      occupancyRate,
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
