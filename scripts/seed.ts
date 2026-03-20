import { PrismaClient } from "@prisma/client";
import { addDays, subDays } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Create listing (real data)
  const listing = await prisma.listing.upsert({
    where: { airbnbId: "1070914382655923214" },
    update: {},
    create: {
      airbnbId: "1070914382655923214",
      title: "T2 60m² · Gare 3min · Vieux Mans à pied",
      description:
        "Spacieux T2 de 60m² idéalement situé à 3 minutes de la gare du Mans et à deux pas du Vieux-Mans historique. Parfait pour les voyageurs d'affaires et les touristes.",
      address: "Le Mans Centre",
      city: "Le Mans",
      basePrice: 85,
      minPrice: 50,
      maxPrice: 400,
      bedrooms: 1,
      bathrooms: 1,
      maxGuests: 4,
      rating: 4.91,
      reviewCount: 319,
      icalUrl: process.env.AIRBNB_ICAL_URL || null,
    },
  });

  console.log(`Created listing: ${listing.title}`);

  // 2. Create pricing rules (refined for 2026)
  const rules = [
    {
      name: "24 Heures du Mans",
      type: "event",
      modifier: 3.5,
      priority: 100,
      daysOfWeek: [] as number[],
    },
    {
      name: "24 Heures Motos",
      type: "event",
      modifier: 2.5,
      priority: 95,
      daysOfWeek: [] as number[],
    },
    {
      name: "MotoGP Le Mans",
      type: "event",
      modifier: 2.5,
      priority: 95,
      daysOfWeek: [] as number[],
    },
    {
      name: "Le Mans Classic",
      type: "event",
      modifier: 3.0,
      priority: 95,
      daysOfWeek: [] as number[],
    },
    {
      name: "Été (haute saison)",
      type: "season",
      modifier: 1.3,
      priority: 20,
      startDate: new Date("2026-06-15"),
      endDate: new Date("2026-08-31"),
      daysOfWeek: [] as number[],
    },
    {
      name: "Hiver (basse saison)",
      type: "season",
      modifier: 0.8,
      priority: 20,
      startDate: new Date("2026-11-01"),
      endDate: new Date("2027-02-28"),
      daysOfWeek: [] as number[],
    },
    {
      name: "Week-end (ven-sam)",
      type: "day_of_week",
      modifier: 1.2,
      priority: 30,
      daysOfWeek: [5, 6],
    },
    {
      name: "Faible remplissage J+7",
      type: "occupancy",
      modifier: 0.85,
      priority: 10,
      condition: { occupancyBelow: 0.4, daysAhead: 7 },
      daysOfWeek: [] as number[],
    },
    {
      name: "Last minute (J-3)",
      type: "last_minute",
      modifier: 0.8,
      priority: 5,
      condition: { daysAhead: 3 },
      daysOfWeek: [] as number[],
    },
    {
      name: "Last minute (J-1)",
      type: "last_minute",
      modifier: 0.7,
      priority: 6,
      condition: { daysAhead: 1 },
      daysOfWeek: [] as number[],
    },
  ];

  for (const rule of rules) {
    await prisma.pricingRule.create({
      data: { listingId: listing.id, ...rule },
    });
  }
  console.log(`Created ${rules.length} pricing rules`);

  // 3. Create competitors
  const competitors = [
    { name: "Appart cozy centre-ville Le Mans", externalId: "comp_001", rating: 4.8, reviewCount: 124, bedrooms: 1 },
    { name: "Studio moderne proche gare TGV", externalId: "comp_002", rating: 4.6, reviewCount: 87, bedrooms: 0 },
    { name: "Maison 3 chambres avec jardin", externalId: "comp_003", rating: 4.9, reviewCount: 203, bedrooms: 3 },
    { name: "Loft design vieille ville", externalId: "comp_004", rating: 4.7, reviewCount: 56, bedrooms: 1 },
    { name: "T2 lumineux bord de Sarthe", externalId: "comp_005", rating: 4.5, reviewCount: 42, bedrooms: 1 },
    { name: "Appart familial 4 personnes", externalId: "comp_006", rating: 4.4, reviewCount: 31, bedrooms: 2 },
    { name: "Charmant duplex cathédrale", externalId: "comp_007", rating: 4.8, reviewCount: 165, bedrooms: 2 },
    { name: "Studio économique centre", externalId: "comp_008", rating: 4.2, reviewCount: 18, bedrooms: 0 },
    { name: "Appartement rénové Place République", externalId: "comp_009", rating: 4.6, reviewCount: 73, bedrooms: 1 },
    { name: "Gîte campagne sarthoise 20min", externalId: "comp_010", rating: 4.9, reviewCount: 95, bedrooms: 2 },
  ];

  for (const comp of competitors) {
    const created = await prisma.competitor.create({
      data: {
        listingId: listing.id,
        externalUrl: `https://www.airbnb.fr/rooms/${comp.externalId}`,
        externalId: comp.externalId,
        name: comp.name,
        address: "Le Mans, France",
        bedrooms: comp.bedrooms,
        rating: comp.rating,
        reviewCount: comp.reviewCount,
        lastScrapedAt: new Date(),
      },
    });

    const baseCompPrice = 55 + Math.random() * 40;
    for (let i = 0; i < 30; i++) {
      const date = addDays(new Date(), i);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
      const price = Math.round(
        baseCompPrice * (isWeekend ? 1.2 : 1) * (0.9 + Math.random() * 0.2)
      );

      await prisma.competitorPrice.create({
        data: { competitorId: created.id, date, price, available: Math.random() > 0.3 },
      });
    }
  }
  console.log(`Created ${competitors.length} competitors with prices`);

  // 4. Create bookings (past months)
  const bookingData = [
    { daysAgo: 170, nights: 3, guest: "Marie L.", pricePn: 75 },
    { daysAgo: 155, nights: 2, guest: "Thomas D.", pricePn: 85 },
    { daysAgo: 140, nights: 5, guest: "Sophie M.", pricePn: 80 },
    { daysAgo: 125, nights: 2, guest: "Pierre R.", pricePn: 95 },
    { daysAgo: 110, nights: 4, guest: "Julie & Marc", pricePn: 85 },
    { daysAgo: 95, nights: 3, guest: "Antoine B.", pricePn: 90 },
    { daysAgo: 80, nights: 7, guest: "Famille Dupont", pricePn: 85 },
    { daysAgo: 65, nights: 2, guest: "Laura K.", pricePn: 80 },
    { daysAgo: 50, nights: 3, guest: "Mohamed A.", pricePn: 85 },
    { daysAgo: 35, nights: 4, guest: "Emma S.", pricePn: 90 },
    { daysAgo: 25, nights: 2, guest: "Jean-Paul V.", pricePn: 85 },
    { daysAgo: 18, nights: 3, guest: "Alice C.", pricePn: 85 },
    { daysAgo: 10, nights: 5, guest: "Ricardo M.", pricePn: 80 },
    { daysAgo: 5, nights: 2, guest: "Nathalie F.", pricePn: 95 },
    { daysAgo: -2, nights: 3, guest: "Lucas T.", pricePn: 85 },
    { daysAgo: -10, nights: 2, guest: null, pricePn: 85 },
    { daysAgo: -18, nights: 4, guest: null, pricePn: 90 },
    { daysAgo: -25, nights: 2, guest: null, pricePn: 85 },
    { daysAgo: -35, nights: 3, guest: null, pricePn: 80 },
    { daysAgo: -50, nights: 5, guest: null, pricePn: 85 },
  ];

  for (const b of bookingData) {
    const checkIn = subDays(new Date(), b.daysAgo);
    const checkOut = addDays(checkIn, b.nights);

    await prisma.booking.create({
      data: {
        listingId: listing.id,
        checkIn,
        checkOut,
        nights: b.nights,
        pricePerNight: b.pricePn,
        totalRevenue: b.pricePn * b.nights,
        cleaningFee: 30,
        guestName: b.guest,
        uid: `seed_booking_${Math.abs(b.daysAgo)}_${Date.now()}`,
        source: "airbnb",
        status: "confirmed",
        revenueSource: "estimated",
      },
    });
  }
  console.log(`Created ${bookingData.length} bookings`);

  // 5. Create reviews
  const reviewsData = [
    { author: "Marie L.", rating: 5, sentiment: "positive", comment: "Superbe appartement, très bien situé en plein centre du Mans. Tout était propre et conforme à l'annonce. L'hôte était très réactif. Je recommande vivement !", keywords: ["propre", "bien situé", "réactif"] },
    { author: "Thomas D.", rating: 4, sentiment: "neutral", comment: "Bon séjour dans l'ensemble. L'appartement est agréable mais le Wi-Fi était instable pendant notre séjour. La literie est confortable et le quartier calme.", keywords: ["wi-fi", "literie", "calme"] },
    { author: "Sophie M.", rating: 3, sentiment: "negative", comment: "Déçue par la propreté de la salle de bain et le bruit de la rue le soir. L'emplacement est bien mais l'insonorisation laisse à désirer.", keywords: ["propreté", "bruit", "insonorisation"] },
    { author: "Pierre R.", rating: 5, sentiment: "positive", comment: "Parfait pour notre week-end au Mans ! L'appartement est exactement comme sur les photos. Merci pour les petites attentions (café, guide local).", keywords: ["photos", "attentions", "café"] },
    { author: "Julie & Marc", rating: 4, sentiment: "positive", comment: "Très bien pour les 24h du Mans ! Un peu cher pendant l'événement mais la localisation compense. Check-in autonome très pratique.", keywords: ["24h du Mans", "localisation", "check-in"] },
    { author: "Antoine B.", rating: 5, sentiment: "positive", comment: "Excellent rapport qualité-prix. L'appartement est fonctionnel et bien équipé. La cuisine a tout ce qu'il faut. Proche des restaurants.", keywords: ["qualité-prix", "équipé", "restaurants"] },
    { author: "Laura K.", rating: 4, sentiment: "positive", comment: "Joli petit appartement bien décoré. Seul bémol : la douche est un peu petite. Mais globalement un très bon séjour, je reviendrai.", keywords: ["décoré", "douche", "séjour"] },
    { author: "Mohamed A.", rating: 2, sentiment: "negative", comment: "Problème de chauffage non résolu pendant tout le séjour. L'hôte a été réactif mais le technicien n'est jamais venu. Décevant pour le prix.", keywords: ["chauffage", "prix", "décevant"] },
    { author: "Emma S.", rating: 5, sentiment: "positive", comment: "Un vrai coup de cœur ! L'appartement est charmant, la vue sur le Vieux-Mans est magnifique. On s'y sent comme chez soi.", keywords: ["charmant", "vue", "Vieux-Mans"] },
    { author: "Jean-Paul V.", rating: 4, sentiment: "neutral", comment: "Correct, rien à redire sur la propreté et l'emplacement. Manque quelques équipements comme un sèche-linge. Parking un peu loin.", keywords: ["propreté", "équipements", "parking"] },
    { author: "Alice C.", rating: 5, sentiment: "positive", comment: "Merveilleux séjour, merci ! L'accueil était top, le logement impeccable. Les recommandations de restaurants étaient parfaites.", keywords: ["accueil", "impeccable", "restaurants"] },
    { author: "Ricardo M.", rating: 4, sentiment: "positive", comment: "Bel appartement, bien placé pour visiter Le Mans. Le lit est très confortable. Bonne isolation phonique contrairement à d'autres logements.", keywords: ["bien placé", "confortable", "isolation"] },
    { author: "Nathalie F.", rating: 3, sentiment: "neutral", comment: "L'appartement est bien mais les photos sont un peu trompeuses sur la taille. Plus petit que prévu. Reste fonctionnel pour un court séjour.", keywords: ["photos", "taille", "fonctionnel"] },
    { author: "Lucas T.", rating: 5, sentiment: "positive", comment: "Tout était parfait pour notre escapade au Mans. L'hôte est aux petits soins. On reviendra avec plaisir !", keywords: ["parfait", "hôte", "escapade"] },
    { author: "Famille Dupont", rating: 4, sentiment: "positive", comment: "Idéal pour une famille avec les 24h du Mans. Bien situé, propre, et l'hôte nous a donné de super conseils pour le circuit.", keywords: ["famille", "propre", "circuit"] },
  ];

  for (let i = 0; i < reviewsData.length; i++) {
    const r = reviewsData[i];
    await prisma.review.create({
      data: {
        listingId: listing.id,
        airbnbId: `review_${i + 1}_${Date.now()}`,
        authorName: r.author,
        rating: r.rating,
        comment: r.comment,
        date: subDays(new Date(), i * 12 + Math.floor(Math.random() * 10)),
        sentiment: r.sentiment,
        keywords: r.keywords,
      },
    });
  }
  console.log(`Created ${reviewsData.length} reviews`);

  // 6. Create events (2025-2026)
  const events = [
    { name: "24 Heures du Mans 2025", startDate: new Date("2025-06-14"), endDate: new Date("2025-06-15"), type: "race", impact: "high" },
    { name: "24 Heures Motos", startDate: new Date("2026-04-18"), endDate: new Date("2026-04-19"), type: "race", impact: "high" },
    { name: "MotoGP Le Mans", startDate: new Date("2026-05-15"), endDate: new Date("2026-05-17"), type: "race", impact: "high" },
    { name: "24 Heures du Mans 2026", startDate: new Date("2026-06-13"), endDate: new Date("2026-06-14"), type: "race", impact: "high" },
    { name: "Le Mans Classic", startDate: new Date("2026-07-04"), endDate: new Date("2026-07-05"), type: "race", impact: "high" },
    { name: "Nuit des Chimères", startDate: new Date("2026-07-01"), endDate: new Date("2026-09-30"), type: "cultural", impact: "medium" },
    { name: "Fête de la Musique", startDate: new Date("2026-06-21"), endDate: new Date("2026-06-21"), type: "concert", impact: "medium" },
    { name: "Foire du Mans", startDate: new Date("2026-09-04"), endDate: new Date("2026-09-13"), type: "fair", impact: "medium" },
    { name: "Marathon du Mans", startDate: new Date("2026-10-11"), endDate: new Date("2026-10-11"), type: "sport", impact: "low" },
  ];

  for (const event of events) {
    await prisma.event.create({
      data: { city: "Le Mans", ...event },
    });
  }
  console.log(`Created ${events.length} events`);

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
