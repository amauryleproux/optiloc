import ical from "node-ical";
import { differenceInDays, parseISO } from "date-fns";

export interface ParsedBooking {
  uid: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guestName: string | null;
  summary: string;
}

export async function parseICalFromUrl(
  icalUrl: string
): Promise<ParsedBooking[]> {
  const events = await ical.async.fromURL(icalUrl);
  const bookings: ParsedBooking[] = [];

  for (const [, event] of Object.entries(events)) {
    if (!event || event.type !== "VEVENT") continue;

    const vevent = event as ical.VEvent;
    const rawSummary = vevent.summary;
    const summary = typeof rawSummary === "string" ? rawSummary : (rawSummary?.val ?? "");

    // Skip manual blocks (only process actual reservations)
    const summaryLower = summary.toLowerCase();
    const isReservation =
      summaryLower.includes("réservé") ||
      summaryLower.includes("reserved") ||
      summaryLower.includes("not available");

    if (!isReservation) continue;

    const checkIn = new Date(vevent.start as unknown as string);
    const checkOut = new Date(vevent.end as unknown as string);
    const nights = differenceInDays(checkOut, checkIn);

    if (nights <= 0) continue;

    // Extract guest name from description if available
    let guestName: string | null = null;
    const rawDesc = vevent.description;
    const description = typeof rawDesc === "string" ? rawDesc : (rawDesc?.val ?? "");
    const nameMatch = description.match(/(?:Guest|Voyageur)\s*:\s*(.+)/i);
    if (nameMatch) {
      guestName = nameMatch[1].trim();
    }

    bookings.push({
      uid: vevent.uid || `booking_${checkIn.toISOString()}`,
      checkIn,
      checkOut,
      nights,
      guestName,
      summary,
    });
  }

  return bookings;
}

export function calculateEstimatedRevenue(
  nights: number,
  basePrice: number,
  modifier: number = 1
): { pricePerNight: number; totalRevenue: number } {
  const pricePerNight = Math.round(basePrice * modifier * 100) / 100;
  const totalRevenue = Math.round(pricePerNight * nights * 100) / 100;
  return { pricePerNight, totalRevenue };
}
