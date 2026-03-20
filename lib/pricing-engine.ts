import { prisma } from "@/lib/prisma";
import {
  differenceInDays,
  startOfDay,
  addDays,
  isWithinInterval,
  getMonth,
  getDay,
  subMonths,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import type { PriceRecommendation } from "@/types";

interface PricingContext {
  listingId: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  occupancyRate: number;
  historicalAvgPrice: number; // prix moyen réel par nuit (CSV)
  competitorAvgTonight: number; // moyenne concurrents ce soir
}

/**
 * Calcule un prix recommandé pour une date donnée en tenant compte de :
 * - Règles de pricing (événements, saison, jour de semaine, last minute, occupation)
 * - Prix réels historiques (import CSV Airbnb)
 * - Prix des concurrents (scraping)
 */
export async function calculateRecommendedPrice(
  context: PricingContext,
  date: Date
): Promise<PriceRecommendation> {
  const today = startOfDay(new Date());
  const targetDate = startOfDay(date);
  const daysAhead = differenceInDays(targetDate, today);

  // Get active pricing rules
  const rules = await prisma.pricingRule.findMany({
    where: { listingId: context.listingId, active: true },
    orderBy: { priority: "desc" },
  });

  // Get events for this date
  const events = await prisma.event.findMany({
    where: {
      startDate: { lte: targetDate },
      endDate: { gte: targetDate },
    },
  });

  // Check if date is booked
  const booking = await prisma.booking.findFirst({
    where: {
      listingId: context.listingId,
      checkIn: { lte: targetDate },
      checkOut: { gt: targetDate },
      status: "confirmed",
    },
  });

  const appliedRules: { name: string; modifier: number }[] = [];
  let finalModifier = 1;
  const reasonParts: string[] = [];

  // 1. Events (highest priority — ex: 24h du Mans)
  if (events.length > 0) {
    const highImpactEvent = events.find((e) => e.impact === "high");
    if (highImpactEvent) {
      const eventRule = rules.find((r) => r.type === "event") || {
        modifier: 3.0,
      };
      finalModifier *= eventRule.modifier;
      appliedRules.push({
        name: `Événement: ${highImpactEvent.name}`,
        modifier: eventRule.modifier,
      });
      reasonParts.push(
        `Événement "${highImpactEvent.name}" — forte demande attendue`
      );
    }
  }

  // 2. Season rules
  const month = getMonth(targetDate);
  const seasonRule = rules.find((r) => {
    if (r.type !== "season") return false;
    if (r.startDate && r.endDate) {
      return isWithinInterval(targetDate, {
        start: r.startDate,
        end: r.endDate,
      });
    }
    if (
      r.name.toLowerCase().includes("été") ||
      r.name.toLowerCase().includes("haute")
    ) {
      return month >= 6 && month <= 7;
    }
    if (
      r.name.toLowerCase().includes("hiver") ||
      r.name.toLowerCase().includes("basse")
    ) {
      return month >= 10 || month <= 1;
    }
    return false;
  });

  if (seasonRule && events.length === 0) {
    finalModifier *= seasonRule.modifier;
    appliedRules.push({
      name: seasonRule.name,
      modifier: seasonRule.modifier,
    });
    reasonParts.push(
      `${seasonRule.name} (${seasonRule.modifier > 1 ? "+" : ""}${Math.round((seasonRule.modifier - 1) * 100)}%)`
    );
  }

  // 3. Day of week
  const dayOfWeek = targetDate.getDay();
  const dowRule = rules.find(
    (r) => r.type === "day_of_week" && r.daysOfWeek.includes(dayOfWeek)
  );
  if (dowRule) {
    finalModifier *= dowRule.modifier;
    appliedRules.push({ name: dowRule.name, modifier: dowRule.modifier });
    reasonParts.push(
      `Week-end (+${Math.round((dowRule.modifier - 1) * 100)}%)`
    );
  }

  // 4. Low occupancy
  const occRule = rules.find((r) => {
    if (r.type !== "occupancy") return false;
    const cond = r.condition as
      | { occupancyBelow?: number; daysAhead?: number }
      | null;
    if (!cond) return false;
    return (
      context.occupancyRate < (cond.occupancyBelow || 0.4) &&
      daysAhead <= (cond.daysAhead || 7)
    );
  });
  if (occRule) {
    finalModifier *= occRule.modifier;
    appliedRules.push({ name: occRule.name, modifier: occRule.modifier });
    reasonParts.push(
      `Faible taux d'occupation (${Math.round(context.occupancyRate * 100)}%)`
    );
  }

  // 5. Last minute
  const lastMinuteRule = rules.find((r) => {
    if (r.type !== "last_minute") return false;
    const cond = r.condition as { daysAhead?: number } | null;
    return daysAhead <= (cond?.daysAhead || 3) && daysAhead >= 0;
  });
  if (lastMinuteRule && !booking && events.length === 0) {
    finalModifier *= lastMinuteRule.modifier;
    appliedRules.push({
      name: lastMinuteRule.name,
      modifier: lastMinuteRule.modifier,
    });
    reasonParts.push("Dernière minute — réduction pour remplir");
  }

  // --- Calculate base from historical data ---
  // Use the historical avg price per night as a more realistic base
  const effectiveBase =
    context.historicalAvgPrice > 0
      ? context.historicalAvgPrice
      : context.basePrice;

  let recommendedPrice = Math.round(effectiveBase * finalModifier);

  // --- Competitor adjustment ---
  // Get competitor prices for this date
  const competitorPrices = await prisma.competitorPrice.findMany({
    where: {
      date: {
        gte: new Date(targetDate.getTime() - 86400000),
        lte: new Date(targetDate.getTime() + 86400000),
      },
      available: true,
    },
    include: { competitor: { select: { source: true } } },
  });

  const airbnbPrices = competitorPrices
    .filter((p) => p.competitor.source === "airbnb")
    .map((p) => p.price);
  const hotelPrices = competitorPrices
    .filter((p) => p.competitor.source === "hotel")
    .map((p) => p.price);

  const airbnbAvg =
    airbnbPrices.length > 0
      ? Math.round(airbnbPrices.reduce((s, p) => s + p, 0) / airbnbPrices.length)
      : undefined;
  const hotelAvg =
    hotelPrices.length > 0
      ? Math.round(hotelPrices.reduce((s, p) => s + p, 0) / hotelPrices.length)
      : undefined;
  const competitorAvg =
    airbnbAvg || hotelAvg
      ? Math.round(((airbnbAvg || 0) * 0.7 + (hotelAvg || 0) * 0.3) / (airbnbAvg && hotelAvg ? 1 : (airbnbAvg ? 0.7 : 0.3)))
      : undefined;

  // Adjust toward competitor average if we're significantly off
  if (competitorAvg && events.length === 0) {
    const diff = competitorAvg - recommendedPrice;
    const diffPercent = diff / recommendedPrice;

    if (Math.abs(diffPercent) > 0.15) {
      // Move 30% toward competitor average
      const adjustment = Math.round(diff * 0.3);
      recommendedPrice += adjustment;
      if (adjustment !== 0) {
        reasonParts.push(
          `Ajustement concurrents (moy. ${competitorAvg}€ → ${adjustment > 0 ? "+" : ""}${adjustment}€)`
        );
      }
    } else {
      reasonParts.push(`En ligne avec les concurrents (moy. ${competitorAvg}€)`);
    }
  }

  // Apply bounds
  recommendedPrice = Math.max(
    context.minPrice,
    Math.min(context.maxPrice, recommendedPrice)
  );

  if (reasonParts.length === 0) {
    reasonParts.push("Prix de base appliqué");
  }

  return {
    date: targetDate,
    basePrice: effectiveBase,
    recommendedPrice,
    appliedRules,
    reasoning: reasonParts.join(" | "),
    competitorAvg,
    isAvailable: !booking,
  };
}

/**
 * Calcule le prix moyen par nuit depuis les données CSV historiques (3 derniers mois).
 */
async function getHistoricalAvgPrice(listingId: string): Promise<number> {
  const threeMonthsAgo = startOfMonth(subMonths(new Date(), 3));
  const bookings = await prisma.booking.findMany({
    where: {
      listingId,
      revenueSource: "csv",
      checkIn: { gte: threeMonthsAgo },
    },
    select: { pricePerNight: true },
  });

  if (bookings.length === 0) return 0;

  return Math.round(
    bookings.reduce((sum, b) => sum + b.pricePerNight, 0) / bookings.length
  );
}

export async function getRecommendationsForRange(
  listingId: string,
  days: number = 60
): Promise<PriceRecommendation[]> {
  const listing = await prisma.listing.findUniqueOrThrow({
    where: { id: listingId },
  });

  // Calculate current occupancy rate (next 30 days)
  const now = new Date();
  const thirtyDaysFromNow = addDays(now, 30);
  const bookings = await prisma.booking.findMany({
    where: {
      listingId,
      checkIn: { lte: thirtyDaysFromNow },
      checkOut: { gte: now },
      status: "confirmed",
    },
  });

  let bookedNights = 0;
  for (const b of bookings) {
    const start = b.checkIn > now ? b.checkIn : now;
    const end = b.checkOut < thirtyDaysFromNow ? b.checkOut : thirtyDaysFromNow;
    bookedNights += Math.max(0, differenceInDays(end, start));
  }
  const occupancyRate = bookedNights / 30;

  // Get historical average price from CSV data
  const historicalAvgPrice = await getHistoricalAvgPrice(listingId);

  // Get competitor average for today
  const todayPrices = await prisma.competitorPrice.findMany({
    where: {
      date: {
        gte: startOfDay(now),
        lte: addDays(startOfDay(now), 1),
      },
      available: true,
    },
  });
  const competitorAvgTonight =
    todayPrices.length > 0
      ? Math.round(
          todayPrices.reduce((s, p) => s + p.price, 0) / todayPrices.length
        )
      : 0;

  const context: PricingContext = {
    listingId,
    basePrice: listing.basePrice,
    minPrice: listing.minPrice,
    maxPrice: listing.maxPrice,
    occupancyRate,
    historicalAvgPrice,
    competitorAvgTonight,
  };

  const recommendations: PriceRecommendation[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(startOfDay(now), i);
    const rec = await calculateRecommendedPrice(context, date);
    recommendations.push(rec);
  }

  return recommendations;
}
