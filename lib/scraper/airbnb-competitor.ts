import type { CompetitorData } from "@/types";

const AIRBNB_API_KEY = "d306zoyjsyarp7ifhu67rjxn52tv0t20";

interface AirbnbListing {
  listing: {
    id: number;
    name: string;
    city: string;
    neighborhood?: string;
    lat: number;
    lng: number;
    person_capacity: number;
    bedrooms: number;
    star_rating?: number;
    reviews_count?: number;
    picture_url?: string;
    property_type_id?: number;
  };
  pricing_quote?: {
    structured_stay_display_price?: {
      primary_line?: { price?: string; discounted_price?: string };
    };
    rate?: { amount?: number };
    rate_type?: string;
    nightly_price?: number;
  };
}

interface AirbnbSearchResponse {
  explore_tabs?: Array<{
    sections?: Array<{
      listings?: AirbnbListing[];
    }>;
  }>;
  search_results?: AirbnbListing[];
}

/**
 * Scrape Airbnb search results via their public explore API.
 * No external service needed — direct HTTP request.
 */
export async function scrapeAirbnbCompetitors(
  city: string,
  checkin: string,
  checkout: string,
  maxResults: number = 20
): Promise<CompetitorData[]> {
  console.log(`[Airbnb Scraper] Scraping ${city} du ${checkin} au ${checkout}...`);

  try {
    // Use Airbnb's explore_tabs API (public, no auth required)
    const params = new URLSearchParams({
      _format: "for_explore_search_web",
      currency: "EUR",
      locale: "fr",
      key: AIRBNB_API_KEY,
      query: city,
      checkin,
      checkout,
      adults: "2",
      items_per_grid: String(maxResults),
      room_types: "Entire home/apt",
      search_type: "filter_change",
    });

    const res = await fetch(
      `https://www.airbnb.fr/api/v2/explore_tabs?${params}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
          "Accept-Language": "fr-FR,fr;q=0.9",
        },
      }
    );

    if (!res.ok) {
      console.log(`[Airbnb Scraper] API v2 returned ${res.status}, trying v3...`);
      return await scrapeAirbnbV3(city, checkin, checkout, maxResults);
    }

    // Extract precise listing IDs from raw text before JSON.parse loses precision
    const rawText = await res.text();
    const idMap = new Map<number, string>();
    const idMatches = rawText.matchAll(/"id"\s*:\s*(\d{10,})/g);
    for (const m of idMatches) {
      const precise = m[1];
      const lossy = Number(precise);
      idMap.set(lossy, precise);
    }
    const data: AirbnbSearchResponse = JSON.parse(rawText);

    const listings: AirbnbListing[] = [];
    if (data.explore_tabs) {
      for (const tab of data.explore_tabs) {
        for (const section of tab.sections || []) {
          if (section.listings) {
            listings.push(...section.listings);
          }
        }
      }
    }

    if (listings.length === 0) {
      console.log("[Airbnb Scraper] API v2 returned 0 listings, trying v3...");
      return await scrapeAirbnbV3(city, checkin, checkout, maxResults);
    }

    console.log(`[Airbnb Scraper] Found ${listings.length} listings`);
    const today = new Date();

    return listings.slice(0, maxResults).map((item) => {
      const l = item.listing;
      const price =
        item.pricing_quote?.nightly_price ||
        item.pricing_quote?.rate?.amount ||
        0;

      // Recover precise listing ID (JS Number loses precision on 19-digit Airbnb IDs)
      const picUrl = l.picture_url || "";
      const idFromPic = picUrl.match(/Hosting-(\d+)\//)?.[1];
      const idFromMap = idMap.get(l.id as unknown as number);
      const listingId = idFromPic || idFromMap || String(l.id);

      return {
        source: "airbnb" as const,
        externalUrl: `https://www.airbnb.fr/rooms/${listingId}`,
        externalId: listingId,
        name: l.name,
        price,
        rating: l.star_rating || 0,
        reviewCount: l.reviews_count || 0,
        available: true,
        date: today,
        propertyType: "apartment",
        imageUrl: l.picture_url || undefined,
        bedrooms: l.bedrooms,
        address: l.neighborhood || l.city,
      };
    });
  } catch (error) {
    console.error("[Airbnb Scraper] Error:", error);
    return [];
  }
}

/**
 * Fallback: scrape via Airbnb's v3 StaysSearch API (GraphQL-based).
 */
async function scrapeAirbnbV3(
  city: string,
  checkin: string,
  checkout: string,
  maxResults: number
): Promise<CompetitorData[]> {
  try {
    const variables = {
      staysSearchRequest: {
        metadataOnly: false,
        rawParams: [
          { filterName: "query", filterValues: [city] },
          { filterName: "checkin", filterValues: [checkin] },
          { filterName: "checkout", filterValues: [checkout] },
          { filterName: "adults", filterValues: ["2"] },
          { filterName: "roomTypes", filterValues: ["Entire home/apt"] },
          { filterName: "currency", filterValues: ["EUR"] },
          { filterName: "itemsPerGrid", filterValues: [String(maxResults)] },
        ],
        requestedPageType: "STAYS_SEARCH",
        searchType: "AUTOSUGGEST",
      },
    };

    const extensions = {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "bfa498e26fcc48e81dfe8a4e3e1dfc6b7a637c30c73df52b8e06bb2e3c4ad383",
      },
    };

    const params = new URLSearchParams({
      operationName: "StaysSearch",
      locale: "fr",
      currency: "EUR",
      variables: JSON.stringify(variables),
      extensions: JSON.stringify(extensions),
    });

    const res = await fetch(
      `https://www.airbnb.fr/api/v3/StaysSearch/bfa498e26fcc48e81dfe8a4e3e1dfc6b7a637c30c73df52b8e06bb2e3c4ad383?${params}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
          "X-Airbnb-Api-Key": AIRBNB_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      console.error(`[Airbnb Scraper v3] Status ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results: CompetitorData[] = [];
    const today = new Date();

    // Navigate the GraphQL response
    const sections =
      data?.data?.presentation?.staysSearch?.results?.searchResults || [];

    for (const section of sections) {
      const listing = section?.listing;
      const price = section?.pricingQuote?.structuredStayDisplayPrice?.primaryLine;
      const priceAmount = price?.price
        ? parseInt(price.price.replace(/[^0-9]/g, ""))
        : section?.pricingQuote?.rate?.amount || 0;

      if (listing && priceAmount > 0) {
        results.push({
          source: "airbnb",
          externalUrl: `https://www.airbnb.fr/rooms/${listing.id}`,
          externalId: String(listing.id),
          name: listing.name || listing.title || "Listing",
          price: priceAmount,
          rating: listing.avgRating || listing.starRating || 0,
          reviewCount: listing.reviewsCount || 0,
          available: true,
          date: today,
          propertyType: listing.roomTypeCategory || "apartment",
          imageUrl: listing.contextualPictures?.[0]?.picture || undefined,
          bedrooms: listing.bedrooms,
          address: listing.city,
        });
      }
    }

    console.log(`[Airbnb Scraper v3] Found ${results.length} listings`);
    return results;
  } catch (error) {
    console.error("[Airbnb Scraper v3] Error:", error);
    return [];
  }
}
