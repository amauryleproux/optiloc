import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeAllCompetitors } from "@/lib/scraper";
import { format, addDays } from "date-fns";
import type { CompetitorData } from "@/types";

export const maxDuration = 120; // Vercel Pro: 5min max, Free: 60s

export async function POST() {
  try {
    const listing = await prisma.listing.findFirst();

    if (!listing) {
      return NextResponse.json(
        { error: "Aucun logement configuré" },
        { status: 400 }
      );
    }

    const today = new Date();
    const tomorrow = addDays(today, 1);

    const { airbnb, hotels } = await scrapeAllCompetitors(
      listing.city,
      format(today, "yyyy-MM-dd"),
      format(tomorrow, "yyyy-MM-dd")
    );

    const allResults = [...airbnb, ...hotels];
    let created = 0;
    let updated = 0;

    for (const result of allResults) {
      // Upsert competitor
      const competitor = await prisma.competitor.upsert({
        where: {
          source_externalId: {
            source: result.source,
            externalId: result.externalId,
          },
        },
        create: {
          listingId: listing.id,
          source: result.source,
          externalUrl: result.externalUrl,
          externalId: result.externalId,
          name: result.name,
          address: result.address || null,
          bedrooms: result.bedrooms || null,
          rating: result.rating || null,
          reviewCount: result.reviewCount || null,
          propertyType: result.propertyType || null,
          imageUrl: result.imageUrl || null,
          lastScrapedAt: new Date(),
        },
        update: {
          name: result.name,
          rating: result.rating || undefined,
          reviewCount: result.reviewCount || undefined,
          imageUrl: result.imageUrl || undefined,
          lastScrapedAt: new Date(),
        },
      });

      // Upsert price for today
      await upsertPrice(competitor.id, result);

      if (competitor.createdAt.getTime() > today.getTime() - 60000) {
        created++;
      } else {
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      airbnb: airbnb.length,
      hotels: hotels.length,
      created,
      updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: "Erreur lors du scraping des concurrents" },
      { status: 500 }
    );
  }
}

async function upsertPrice(competitorId: string, result: CompetitorData) {
  // Normalize date to midnight
  const date = new Date(result.date);
  date.setHours(12, 0, 0, 0);

  await prisma.competitorPrice.upsert({
    where: {
      competitorId_date: { competitorId, date },
    },
    create: {
      competitorId,
      date,
      price: result.price,
      available: result.available,
    },
    update: {
      price: result.price,
      available: result.available,
      scrapedAt: new Date(),
    },
  });
}
