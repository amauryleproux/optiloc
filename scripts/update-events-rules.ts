import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const listing = await prisma.listing.findFirst();
  if (!listing) {
    console.error("No listing found!");
    return;
  }

  // Delete old events and insert 2026 events
  await prisma.event.deleteMany({});
  console.log("Cleared old events");

  const events = [
    // 2025 events (past/reference)
    { name: "24 Heures du Mans 2025", startDate: new Date("2025-06-14"), endDate: new Date("2025-06-15"), type: "race", impact: "high" },
    // 2026 events
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
  console.log(`Created ${events.length} events for 2025-2026`);

  // Delete old pricing rules and create refined ones
  await prisma.pricingRule.deleteMany({ where: { listingId: listing.id } });
  console.log("Cleared old pricing rules");

  const rules = [
    // Events (highest priority)
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
    // Seasons
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
    // Day of week
    {
      name: "Week-end (ven-sam)",
      type: "day_of_week",
      modifier: 1.2,
      priority: 30,
      daysOfWeek: [5, 6],
    },
    // Occupancy
    {
      name: "Faible remplissage J+7",
      type: "occupancy",
      modifier: 0.85,
      priority: 10,
      condition: { occupancyBelow: 0.4, daysAhead: 7 },
      daysOfWeek: [] as number[],
    },
    // Last minute
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
      data: {
        listingId: listing.id,
        ...rule,
      },
    });
  }
  console.log(`Created ${rules.length} pricing rules`);

  // Update listing base price to 85€ (user's actual price)
  await prisma.listing.update({
    where: { id: listing.id },
    data: {
      basePrice: 85,
      minPrice: 50,
      maxPrice: 400,
    },
  });
  console.log("Updated listing prices (base: 85€, min: 50€, max: 400€)");

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
