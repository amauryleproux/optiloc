import type { CompetitorData } from "@/types";
import { scrapeAirbnbCompetitors } from "./airbnb-competitor";
import { scrapeHotels } from "./hotel-scraper";

/**
 * Scrape tous les concurrents (Airbnb + Hôtels) pour une date.
 */
export async function scrapeAllCompetitors(
  city: string,
  checkin: string,
  checkout: string
): Promise<{ airbnb: CompetitorData[]; hotels: CompetitorData[] }> {
  const [airbnbResult, hotelResult] = await Promise.allSettled([
    scrapeAirbnbCompetitors(city, checkin, checkout),
    scrapeHotels(city, checkin, checkout),
  ]);

  const airbnb =
    airbnbResult.status === "fulfilled" ? airbnbResult.value : [];
  const hotels =
    hotelResult.status === "fulfilled" ? hotelResult.value : [];

  if (airbnbResult.status === "rejected") {
    console.error("[Orchestrator] Airbnb scraping failed:", airbnbResult.reason);
  }
  if (hotelResult.status === "rejected") {
    console.error("[Orchestrator] Hotel scraping failed:", hotelResult.reason);
  }

  console.log(
    `[Orchestrator] Scraped ${airbnb.length} Airbnb + ${hotels.length} hôtels`
  );

  return { airbnb, hotels };
}

/**
 * Scrape les concurrents sur plusieurs dates clés (30 prochains jours).
 * Dates selectionnées : aujourd'hui, demain, puis chaque vendredi/samedi
 * + J+7, J+14, J+21, J+28 pour couvrir les jours de semaine.
 *
 * Retourne toutes les données avec la bonne date sur chaque résultat.
 */
export async function scrapeCompetitorsMultiDate(
  city: string,
  days: number = 30
): Promise<{ airbnb: CompetitorData[]; hotels: CompetitorData[] }> {
  const today = new Date();
  const allAirbnb: CompetitorData[] = [];
  const allHotels: CompetitorData[] = [];

  // Dates clés à scraper : aujourd'hui + dates stratégiques
  const offsets = buildDateOffsets(today, days);

  console.log(
    `[Orchestrator] Multi-date scraping: ${offsets.length} dates sur ${days} jours`
  );

  for (const offset of offsets) {
    const checkinDate = addDaysSimple(today, offset);
    const checkoutDate = addDaysSimple(today, offset + 1);
    const checkin = formatDate(checkinDate);
    const checkout = formatDate(checkoutDate);

    console.log(`[Orchestrator] Scraping date ${checkin}...`);

    const { airbnb, hotels } = await scrapeAllCompetitors(city, checkin, checkout);

    // Set the correct date on each result
    for (const r of airbnb) {
      allAirbnb.push({ ...r, date: checkinDate });
    }
    for (const r of hotels) {
      allHotels.push({ ...r, date: checkinDate });
    }

    // Rate limit : 2s entre chaque requête pour ne pas se faire bloquer
    if (offset !== offsets[offsets.length - 1]) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(
    `[Orchestrator] Multi-date total: ${allAirbnb.length} Airbnb + ${allHotels.length} hôtels sur ${offsets.length} dates`
  );

  return { airbnb: allAirbnb, hotels: allHotels };
}

/**
 * Construit les offsets de dates à scraper.
 * Stratégie : couvrir les jours clés sans trop de requêtes.
 * - Aujourd'hui et demain (données fraîches)
 * - Prochains vendredis et samedis (week-ends = forte demande)
 * - J+7, J+14, J+21, J+28 (couverture semaine)
 */
function buildDateOffsets(today: Date, days: number): number[] {
  const offsets = new Set<number>();

  // Aujourd'hui et demain
  offsets.add(0);
  offsets.add(1);

  // Prochains vendredis (5) et samedis (6)
  for (let i = 0; i < days; i++) {
    const d = addDaysSimple(today, i);
    const dow = d.getDay();
    if (dow === 5 || dow === 6) {
      offsets.add(i);
    }
  }

  // Dates fixes pour couverture semaine
  for (const d of [3, 7, 10, 14, 21, 28]) {
    if (d < days) offsets.add(d);
  }

  return Array.from(offsets).sort((a, b) => a - b);
}

function addDaysSimple(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
