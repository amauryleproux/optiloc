import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  differenceInDays,
  format,
  startOfWeek,
  addWeeks,
  addDays,
} from "date-fns";
import { fr } from "date-fns/locale";

export async function GET() {
  try {
    const listing = await prisma.listing.findFirst();
    if (!listing) {
      return NextResponse.json({ error: "No listing found" }, { status: 404 });
    }

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Bookings this month
    // For CSV bookings: use payoutDate (matches Airbnb's monthly reporting)
    // For estimated bookings (iCal): use checkIn as fallback
    const thisMonthBookings = await prisma.booking.findMany({
      where: {
        listingId: listing.id,
        status: "confirmed",
        OR: [
          { payoutDate: { gte: thisMonthStart, lte: thisMonthEnd } },
          { payoutDate: null, checkIn: { gte: thisMonthStart, lte: thisMonthEnd } },
        ],
      },
    });

    // Bookings last month
    const lastMonthBookings = await prisma.booking.findMany({
      where: {
        listingId: listing.id,
        status: "confirmed",
        OR: [
          { payoutDate: { gte: lastMonthStart, lte: lastMonthEnd } },
          { payoutDate: null, checkIn: { gte: lastMonthStart, lte: lastMonthEnd } },
        ],
      },
    });

    // Revenue this month
    const revenue = thisMonthBookings.reduce((sum, b) => sum + b.totalRevenue, 0);
    const revenuePrevMonth = lastMonthBookings.reduce((sum, b) => sum + b.totalRevenue, 0);

    // Occupancy this month (booked nights / days in month)
    const daysInMonth = differenceInDays(thisMonthEnd, thisMonthStart) + 1;
    let bookedNightsThisMonth = 0;
    for (const b of thisMonthBookings) {
      const start = b.checkIn > thisMonthStart ? b.checkIn : thisMonthStart;
      const end = b.checkOut < thisMonthEnd ? b.checkOut : thisMonthEnd;
      bookedNightsThisMonth += Math.max(0, differenceInDays(end, start));
    }
    const occupancyRate = Math.round((bookedNightsThisMonth / daysInMonth) * 100);

    const daysInLastMonth = differenceInDays(lastMonthEnd, lastMonthStart) + 1;
    let bookedNightsLastMonth = 0;
    for (const b of lastMonthBookings) {
      const start = b.checkIn > lastMonthStart ? b.checkIn : lastMonthStart;
      const end = b.checkOut < lastMonthEnd ? b.checkOut : lastMonthEnd;
      bookedNightsLastMonth += Math.max(0, differenceInDays(end, start));
    }
    const occupancyPrevMonth = Math.round((bookedNightsLastMonth / daysInLastMonth) * 100);

    // Avg price per night
    const avgPricePerNight = thisMonthBookings.length > 0
      ? Math.round(thisMonthBookings.reduce((s, b) => s + b.pricePerNight, 0) / thisMonthBookings.length)
      : listing.basePrice;
    const avgPricePrevMonth = lastMonthBookings.length > 0
      ? Math.round(lastMonthBookings.reduce((s, b) => s + b.pricePerNight, 0) / lastMonthBookings.length)
      : listing.basePrice;

    // KPIs
    const kpis = {
      revenue,
      revenuePrevMonth: revenuePrevMonth || 1,
      occupancyRate,
      occupancyPrevMonth,
      avgPricePerNight,
      avgPricePrevMonth: avgPricePrevMonth || 1,
      avgRating: listing.rating || 0,
      ratingPrevMonth: listing.rating || 0,
    };

    // Revenue chart (last 12 months — by payout date, fallback to check-in)
    const revenueChart = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const mStart = startOfMonth(monthDate);
      const mEnd = endOfMonth(monthDate);
      const monthBookings = await prisma.booking.findMany({
        where: {
          listingId: listing.id,
          status: "confirmed",
          OR: [
            { payoutDate: { gte: mStart, lte: mEnd } },
            { payoutDate: null, checkIn: { gte: mStart, lte: mEnd } },
          ],
        },
      });
      const monthRevenue = monthBookings.reduce((s, b) => s + b.totalRevenue, 0);
      revenueChart.push({
        month: format(monthDate, "MMM", { locale: fr }),
        revenue: Math.round(monthRevenue),
      });
    }

    // Occupancy chart (next 8 weeks)
    const occupancyChart = [];
    for (let i = 0; i < 8; i++) {
      const weekStart = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), i);
      const weekEnd = addDays(weekStart, 7);
      const weekBookings = await prisma.booking.findMany({
        where: {
          listingId: listing.id,
          status: "confirmed",
          checkIn: { lte: weekEnd },
          checkOut: { gte: weekStart },
        },
      });
      let bookedDays = 0;
      for (const b of weekBookings) {
        const start = b.checkIn > weekStart ? b.checkIn : weekStart;
        const end = b.checkOut < weekEnd ? b.checkOut : weekEnd;
        bookedDays += Math.max(0, differenceInDays(end, start));
      }
      occupancyChart.push({
        week: `S${i + 1}`,
        rate: Math.round((bookedDays / 7) * 100),
      });
    }

    // Alerts
    const alerts = [];

    // Check availability in next 7 days
    const next7 = addDays(now, 7);
    const next7Bookings = await prisma.booking.findMany({
      where: {
        listingId: listing.id,
        status: "confirmed",
        checkIn: { lte: next7 },
        checkOut: { gte: now },
      },
    });
    let bookedNext7 = 0;
    for (const b of next7Bookings) {
      const start = b.checkIn > now ? b.checkIn : now;
      const end = b.checkOut < next7 ? b.checkOut : next7;
      bookedNext7 += Math.max(0, differenceInDays(end, start));
    }
    const availableNext7 = 7 - bookedNext7;
    if (availableNext7 >= 2) {
      alerts.push({
        type: "warning",
        title: `${availableNext7} nuits disponibles dans 7 jours`,
        message: "Envisagez une réduction de 15% pour remplir ces créneaux.",
      });
    }

    // Check upcoming events
    const events = await prisma.event.findMany({
      where: {

        startDate: { gte: now, lte: addDays(now, 90) },
        impact: "high",
      },
    });
    for (const event of events) {
      const daysUntil = differenceInDays(event.startDate, now);
      alerts.push({
        type: "info",
        title: `${event.name} dans ${daysUntil} jours`,
        message: "Vos prix sont-ils optimisés pour cet événement ?",
      });
    }

    // Rating alert
    if (listing.rating && listing.rating < 4.8) {
      alerts.push({
        type: "danger",
        title: `Note actuelle : ${listing.rating}/5`,
        message: "Consultez la page Avis pour identifier les axes d'amélioration.",
      });
    }

    return NextResponse.json({
      kpis,
      revenueChart,
      occupancyChart,
      alerts,
      listing: {
        title: listing.title,
        city: listing.city,
        lastSyncAt: listing.lastSyncAt,
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du dashboard" },
      { status: 500 }
    );
  }
}
