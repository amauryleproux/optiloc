import type { CompetitorData } from "@/types";
import { scrapeAirbnbCompetitors } from "./airbnb-competitor";
import { scrapeHotels } from "./hotel-scraper";

/**
 * Scrape tous les concurrents (Airbnb + Hôtels) en parallèle.
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
