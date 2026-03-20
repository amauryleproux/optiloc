import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic, LISTING_AUDIT_PROMPT } from "@/lib/anthropic";

export async function POST() {
  try {
    const listing = await prisma.listing.findFirst({
      include: {
        reviews: { orderBy: { date: "desc" }, take: 10 },
        competitors: {
          include: { prices: { orderBy: { date: "desc" }, take: 1 } },
        },
        bookings: {
          where: { status: "confirmed" },
          orderBy: { checkIn: "desc" },
          take: 30,
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Aucun logement configuré" },
        { status: 400 }
      );
    }

    // Calculate occupancy and competitor average
    const totalBookedNights = listing.bookings.reduce(
      (sum, b) => sum + b.nights,
      0
    );
    const occupancyRate = Math.min(
      100,
      Math.round((totalBookedNights / 180) * 100)
    );

    const competitorPrices = listing.competitors
      .map((c) => c.prices[0]?.price)
      .filter(Boolean);
    const avgCompetitorPrice =
      competitorPrices.length > 0
        ? Math.round(
            competitorPrices.reduce((s, p) => s + p, 0) /
              competitorPrices.length
          )
        : null;

    const listingData = `
Titre: ${listing.title}
Description: ${listing.description || "Non renseignée"}
Ville: ${listing.city}
Chambres: ${listing.bedrooms}, SdB: ${listing.bathrooms}, Capacité: ${listing.maxGuests} pers
Prix de base: ${listing.basePrice}€/nuit
Note: ${listing.rating || "N/A"} (${listing.reviewCount} avis)
Taux d'occupation: ${occupancyRate}%
Prix moyen concurrents: ${avgCompetitorPrice ? avgCompetitorPrice + "€" : "N/A"}
Nombre de photos: 12 (estimé)
`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: LISTING_AUDIT_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyse cette annonce Airbnb :\n${listingData}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const result = JSON.parse(content.text);

    // Save score to DB
    await prisma.listingScore.create({
      data: {
        listingId: listing.id,
        totalScore: result.totalScore,
        titleScore: result.scores.title,
        descriptionScore: result.scores.description,
        photoScore: result.scores.photos,
        pricingScore: result.scores.pricing,
        responseScore: 0,
        suggestions: result.suggestions,
        computedAt: new Date(),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Listing audit error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'audit de l'annonce" },
      { status: 500 }
    );
  }
}
