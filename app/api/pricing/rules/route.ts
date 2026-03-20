import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const listing = await prisma.listing.findFirst();
    if (!listing) {
      return NextResponse.json({ rules: [] });
    }

    const rules = await prisma.pricingRule.findMany({
      where: { listingId: listing.id },
      orderBy: { priority: "desc" },
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Get rules error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des règles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const listing = await prisma.listing.findFirst();
    if (!listing) {
      return NextResponse.json(
        { error: "Aucun logement configuré" },
        { status: 400 }
      );
    }

    const rule = await prisma.pricingRule.create({
      data: {
        listingId: listing.id,
        name: body.name,
        type: body.type,
        modifier: body.modifier,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        daysOfWeek: body.daysOfWeek || [],
        condition: body.condition || null,
        priority: body.priority || 0,
        active: body.active ?? true,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Create rule error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la règle" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    const rule = await prisma.pricingRule.update({
      where: { id },
      data,
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("Update rule error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la règle" },
      { status: 500 }
    );
  }
}
