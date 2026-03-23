import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeCompetitorsMultiDate } from "@/lib/scraper";
import type { CompetitorData } from "@/types";

export const maxDuration = 300; // 5 min pour scraper plusieurs dates

export async function POST() {
  try {
    const listing = await prisma.listing.findFirst();

    if (!listing) {
      return NextResponse.json(
        { error: "Aucun logement configuré" },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Scrape sur 30 jours (dates clés : aujourd'hui, demain, week-ends, J+7/14/21/28)
    const { airbnb, hotels } = await scrapeCompetitorsMultiDate(
      listing.city,
      30
    );

    const allResults = [...airbnb, ...hotels];
    let created = 0;
    let updated = 0;
    let pricePoints = 0;

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

      // Upsert price for the specific date
      await upsertPrice(competitor.id, result);
      pricePoints++;

      const now = new Date();
      if (competitor.createdAt.getTime() > now.getTime() - 60000) {
        created++;
      } else {
        updated++;
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    return NextResponse.json({
      success: true,
      airbnb: airbnb.length,
      hotels: hotels.length,
      created,
      updated,
      pricePoints,
      duration: `${duration}s`,
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
  // Normalize date to noon to avoid timezone issues
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
