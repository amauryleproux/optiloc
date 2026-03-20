import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseICalFromUrl, calculateEstimatedRevenue } from "@/lib/ical-parser";

export async function POST() {
  try {
    const listing = await prisma.listing.findFirst();
    if (!listing || !listing.icalUrl) {
      return NextResponse.json(
        { error: "Aucun logement avec URL iCal configuré" },
        { status: 400 }
      );
    }

    const bookings = await parseICalFromUrl(listing.icalUrl);

    let created = 0;
    let skipped = 0;

    for (const booking of bookings) {
      const { pricePerNight, totalRevenue } = calculateEstimatedRevenue(
        booking.nights,
        listing.basePrice
      );

      try {
        // Check if a CSV-imported booking already covers these dates
        const existingCsvBooking = await prisma.booking.findFirst({
          where: {
            listingId: listing.id,
            revenueSource: "csv",
            checkIn: { gte: new Date(booking.checkIn.getTime() - 86400000), lte: new Date(booking.checkIn.getTime() + 86400000) },
            checkOut: { gte: new Date(booking.checkOut.getTime() - 86400000), lte: new Date(booking.checkOut.getTime() + 86400000) },
          },
        });

        if (existingCsvBooking) {
          // CSV data is authoritative — don't overwrite it
          skipped++;
          continue;
        }

        await prisma.booking.upsert({
          where: { uid: booking.uid },
          create: {
            listingId: listing.id,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            nights: booking.nights,
            pricePerNight,
            totalRevenue,
            guestName: booking.guestName,
            uid: booking.uid,
            source: "airbnb",
            status: "confirmed",
          },
          update: {
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            nights: booking.nights,
          },
        });
        created++;
      } catch {
        skipped++;
      }
    }

    await prisma.listing.update({
      where: { id: listing.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      total: bookings.length,
      created,
      skipped,
      lastSync: new Date().toISOString(),
    });
  } catch (error) {
    console.error("iCal sync error:", error);
    return NextResponse.json(
      { error: "Échec de la synchronisation iCal" },
      { status: 500 }
    );
  }
}
