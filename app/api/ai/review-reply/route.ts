import { NextRequest, NextResponse } from "next/server";
import { anthropic, REVIEW_REPLY_PROMPT } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  try {
    const { authorName, rating, comment } = await request.json();

    if (!comment) {
      return NextResponse.json(
        { error: "Le commentaire est requis" },
        { status: 400 }
      );
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: REVIEW_REPLY_PROMPT,
      messages: [
        {
          role: "user",
          content: `Avis de ${authorName || "un voyageur"} (note: ${rating || "N/A"}/5) :\n"${comment}"`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const result = JSON.parse(content.text);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Review reply error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération de la réponse" },
      { status: 500 }
    );
  }
}
