import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { differenceInDays, parse } from "date-fns";

interface CSVRow {
  payoutDate: string;
  confirmationCode: string;
  type: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: string;
  amount: string;
  cleaningFee: string;
  serviceFee: string;
  grossRevenue: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDate(dateStr: string): Date | null {
  // Airbnb exports use MM/DD/YYYY format — try that first
  const formats = ["MM/dd/yyyy", "dd/MM/yyyy", "yyyy-MM-dd"];
  for (const fmt of formats) {
    try {
      const d = parse(dateStr, fmt, new Date());
      if (!isNaN(d.getTime())) return d;
    } catch {
      continue;
    }
  }
  // Fallback: native Date parsing
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function parseAmount(str: string): number {
  // Handle "1 234,56 €" or "1234.56" or "€1,234.56" formats
  const cleaned = str
    .replace(/[€$\s]/g, "")
    .replace(/\u00a0/g, ""); // non-breaking space

  // French format: 1 234,56 → replace comma with dot
  if (cleaned.includes(",") && !cleaned.includes(".")) {
    return parseFloat(cleaned.replace(",", ".")) || 0;
  }
  // US format: 1,234.56 → remove commas
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return parseFloat(cleaned.replace(/,/g, "")) || 0;
  }
  return parseFloat(cleaned) || 0;
}

// Map CSV headers to our fields (supports French & English Airbnb export headers)
const HEADER_MAP: Record<string, keyof CSVRow> = {
  "date": "payoutDate",
  "code de confirmation": "confirmationCode",
  "confirmation code": "confirmationCode",
  "type": "type",
  "nom du voyageur": "guestName",
  "voyageur": "guestName",
  "guest name": "guestName",
  "guest": "guestName",
  "arrivée": "checkIn",
  "date de début": "checkIn",
  "check-in": "checkIn",
  "start date": "checkIn",
  "départ": "checkOut",
  "date de fin": "checkOut",
  "check-out": "checkOut",
  "end date": "checkOut",
  "nuits": "nights",
  "nights": "nights",
  "montant": "amount",
  "amount": "amount",
  "listing earnings": "amount",
  "revenus": "amount",
  "revenus bruts": "grossRevenue",
  "gross earnings": "grossRevenue",
  "frais de ménage": "cleaningFee",
  "cleaning fee": "cleaningFee",
  "frais de service": "serviceFee",
  "service fee": "serviceFee",
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: "Fichier CSV vide ou invalide" }, { status: 400 });
    }

    // Parse headers
    const rawHeaders = parseCSVLine(lines[0]);
    const headerIndices: Partial<Record<keyof CSVRow, number>> = {};

    for (let i = 0; i < rawHeaders.length; i++) {
      const normalized = rawHeaders[i].toLowerCase().trim();
      const mapped = HEADER_MAP[normalized];
      if (mapped) {
        headerIndices[mapped] = i;
      }
    }

    // Validate required headers
    if (headerIndices.checkIn === undefined || headerIndices.checkOut === undefined) {
      return NextResponse.json(
        { error: "Colonnes requises manquantes. Colonnes attendues : arrivée/check-in, départ/check-out" },
        { status: 400 }
      );
    }

    const listing = await prisma.listing.findFirst();
    if (!listing) {
      return NextResponse.json({ error: "Aucun logement trouvé" }, { status: 404 });
    }

    // Step 1: Delete ALL existing CSV bookings for this listing (clean slate for re-import)
    await prisma.booking.deleteMany({
      where: { listingId: listing.id, revenueSource: "csv" },
    });

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const processedIds = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 2) continue;

      const getValue = (key: keyof CSVRow): string => {
        const idx = headerIndices[key];
        return idx !== undefined ? (cols[idx] || "") : "";
      };

      // Skip Payout/transfer rows (they don't contain booking data)
      const rowType = getValue("type").toLowerCase();
      if (rowType && rowType !== "réservation" && rowType !== "reservation") {
        skipped++;
        continue;
      }

      const checkInStr = getValue("checkIn");
      const checkOutStr = getValue("checkOut");
      const checkIn = parseDate(checkInStr);
      const checkOut = parseDate(checkOutStr);

      if (!checkIn || !checkOut) {
        errors.push(`Ligne ${i + 1}: dates invalides (${checkInStr} - ${checkOutStr})`);
        skipped++;
        continue;
      }

      const nights = parseInt(getValue("nights")) || differenceInDays(checkOut, checkIn);
      const amount = parseAmount(getValue("amount"));       // Montant = net reçu (ex: 85.36)
      const grossRevenue = parseAmount(getValue("grossRevenue")); // Revenus bruts (ex: 88.00)
      const cleaningFee = parseAmount(getValue("cleaningFee"));   // Frais de ménage (ex: 5.00)
      const confirmationCode = getValue("confirmationCode");
      const guestName = getValue("guestName");
      const payoutDate = parseDate(getValue("payoutDate"));

      // hostPayout = Montant (ce que tu reçois réellement)
      const hostPayout = amount;
      // totalRevenue = Montant (revenu net versé)
      const totalRevenue = amount;
      // pricePerNight = (Revenus bruts - Frais de ménage) / Nuits
      const pricePerNight = nights > 0
        ? Math.round(((grossRevenue || amount) - cleaningFee) / nights * 100) / 100
        : 0;

      // Try to match an existing iCal booking by confirmation code or date proximity
      // Exclude bookings already processed in this import run
      let existingBooking = null;
      if (confirmationCode) {
        existingBooking = await prisma.booking.findFirst({
          where: {
            listingId: listing.id,
            confirmationCode,
            id: { notIn: Array.from(processedIds) },
          },
        });
      }
      if (!existingBooking) {
        existingBooking = await prisma.booking.findFirst({
          where: {
            listingId: listing.id,
            id: { notIn: Array.from(processedIds) },
            revenueSource: "estimated",
            checkIn: { gte: new Date(checkIn.getTime() - 86400000), lte: new Date(checkIn.getTime() + 86400000) },
            checkOut: { gte: new Date(checkOut.getTime() - 86400000), lte: new Date(checkOut.getTime() + 86400000) },
          },
        });
      }

      if (existingBooking) {
        // Update iCal booking with real CSV data
        await prisma.booking.update({
          where: { id: existingBooking.id },
          data: {
            checkIn,
            checkOut,
            nights,
            totalRevenue,
            pricePerNight,
            cleaningFee,
            hostPayout,
            payoutDate,
            guestName: guestName || existingBooking.guestName,
            confirmationCode: confirmationCode || existingBooking.confirmationCode,
            revenueSource: "csv",
          },
        });
        processedIds.add(existingBooking.id);
        updated++;
      } else {
        // Create new booking
        const created = await prisma.booking.create({
          data: {
            listingId: listing.id,
            checkIn,
            checkOut,
            nights,
            pricePerNight,
            totalRevenue,
            cleaningFee,
            hostPayout,
            payoutDate,
            guestName: guestName || null,
            confirmationCode: confirmationCode || null,
            uid: `csv_${confirmationCode || `${checkIn.getTime()}_${checkOut.getTime()}`}`,
            source: "airbnb",
            status: "confirmed",
            revenueSource: "csv",
          },
        });
        processedIds.add(created.id);
        imported++;
      }
    }

    // Clean up: delete all estimated bookings that overlap with the CSV date range
    // CSV is the source of truth — estimated bookings are now redundant
    const csvBookings = await prisma.booking.findMany({
      where: { listingId: listing.id, revenueSource: "csv" },
      select: { checkIn: true, checkOut: true },
      orderBy: { checkIn: "asc" },
    });

    let cleaned = 0;
    if (csvBookings.length > 0) {
      const minDate = csvBookings[0].checkIn;
      const maxDate = csvBookings[csvBookings.length - 1].checkOut;

      const deleteResult = await prisma.booking.deleteMany({
        where: {
          listingId: listing.id,
          revenueSource: "estimated",
          checkIn: { gte: minDate },
          checkOut: { lte: maxDate },
        },
      });
      cleaned = deleteResult.count;
    }

    return NextResponse.json({
      success: true,
      imported,
      updated,
      skipped,
      cleaned,
      total: lines.length - 1,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import CSV" },
      { status: 500 }
    );
  }
}
