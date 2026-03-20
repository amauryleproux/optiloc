"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star, Sparkles, Copy, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReviewItem {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  date: string;
  sentiment: "positive" | "neutral" | "negative";
  response: string | null;
  aiSuggestion: string | null;
  keywords: string[];
}

const DEMO_REVIEWS: ReviewItem[] = [
  {
    id: "1",
    authorName: "Marie L.",
    rating: 5,
    comment:
      "Superbe appartement, très bien situé en plein centre du Mans. Tout était propre et conforme à l'annonce. L'hôte était très réactif. Je recommande vivement !",
    date: "2025-03-10",
    sentiment: "positive",
    response: null,
    aiSuggestion: null,
    keywords: ["propre", "bien situé", "réactif"],
  },
  {
    id: "2",
    authorName: "Thomas D.",
    rating: 4,
    comment:
      "Bon séjour dans l'ensemble. L'appartement est agréable mais le Wi-Fi était instable pendant notre séjour. La literie est confortable et le quartier calme.",
    date: "2025-03-05",
    sentiment: "neutral",
    response: null,
    aiSuggestion: null,
    keywords: ["wi-fi", "literie", "calme"],
  },
  {
    id: "3",
    authorName: "Sophie M.",
    rating: 3,
    comment:
      "Déçue par la propreté de la salle de bain et le bruit de la rue le soir. L'emplacement est bien mais l'insonorisation laisse à désirer.",
    date: "2025-02-28",
    sentiment: "negative",
    response:
      "Merci Sophie pour votre retour. Nous avons pris des mesures pour améliorer le nettoyage...",
    aiSuggestion: null,
    keywords: ["propreté", "bruit", "insonorisation"],
  },
  {
    id: "4",
    authorName: "Pierre R.",
    rating: 5,
    comment:
      "Parfait pour notre week-end au Mans ! L'appartement est exactement comme sur les photos. Merci pour les petites attentions (café, guide local).",
    date: "2025-02-20",
    sentiment: "positive",
    response: null,
    aiSuggestion: null,
    keywords: ["photos", "attentions", "café"],
  },
  {
    id: "5",
    authorName: "Julie & Marc",
    rating: 4,
    comment:
      "Très bien pour les 24h du Mans ! Un peu cher pendant l'événement mais la localisation compense. Check-in autonome très pratique.",
    date: "2025-06-15",
    sentiment: "positive",
    response: null,
    aiSuggestion: null,
    keywords: ["24h du Mans", "localisation", "check-in"],
  },
];

const sentimentConfig = {
  positive: { label: "Positif", icon: ThumbsUp, color: "text-emerald-600", bg: "bg-emerald-100" },
  neutral: { label: "Neutre", icon: Minus, color: "text-amber-600", bg: "bg-amber-100" },
  negative: { label: "Négatif", icon: ThumbsDown, color: "text-red-600", bg: "bg-red-100" },
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState(DEMO_REVIEWS);
  const [filter, setFilter] = useState<string>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filteredReviews =
    filter === "all"
      ? reviews
      : reviews.filter((r) => r.sentiment === filter);

  const stats = {
    total: reviews.length,
    avgRating:
      reviews.reduce((s, r) => s + r.rating, 0) / reviews.length,
    positive: reviews.filter((r) => r.sentiment === "positive").length,
    neutral: reviews.filter((r) => r.sentiment === "neutral").length,
    negative: reviews.filter((r) => r.sentiment === "negative").length,
  };

  // Keyword frequency
  const keywordCounts: Record<string, number> = {};
  reviews.forEach((r) =>
    r.keywords.forEach((k) => {
      keywordCounts[k] = (keywordCounts[k] || 0) + 1;
    })
  );
  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  async function handleGenerateReply(reviewId: string) {
    setLoadingId(reviewId);
    try {
      const review = reviews.find((r) => r.id === reviewId);
      const res = await fetch("/api/ai/review-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: review?.authorName,
          rating: review?.rating,
          comment: review?.comment,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId ? { ...r, aiSuggestion: data.reply } : r
          )
        );
      }
    } catch (e) {
      console.error("AI reply failed", e);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total avis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="text-2xl font-bold">
                {stats.avgRating.toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Note moyenne</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {stats.positive}
            </p>
            <p className="text-xs text-muted-foreground">Positifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {stats.neutral}
            </p>
            <p className="text-xs text-muted-foreground">Neutres</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {stats.negative}
            </p>
            <p className="text-xs text-muted-foreground">Négatifs</p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Insights IA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            {topKeywords.map(([keyword, count]) => (
              <Badge key={keyword} variant="secondary" className="text-xs">
                {keyword} ({count})
              </Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Les voyageurs mentionnent souvent : <strong>propreté</strong> (+),{" "}
            <strong>localisation</strong> (+), <strong>wi-fi</strong> (-).
            Considérez améliorer votre connexion internet.
          </p>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v ?? "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrer par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les avis</SelectItem>
            <SelectItem value="positive">Positifs</SelectItem>
            <SelectItem value="neutral">Neutres</SelectItem>
            <SelectItem value="negative">Négatifs</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {filteredReviews.length} avis
        </p>
      </div>

      {/* Reviews list */}
      <div className="space-y-4">
        {filteredReviews.map((review) => {
          const sentCfg = sentimentConfig[review.sentiment];
          const SentIcon = sentCfg.icon;
          return (
            <Card key={review.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                      {review.authorName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {review.authorName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {review.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-3.5 w-3.5",
                            i < review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-200"
                          )}
                        />
                      ))}
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn("text-xs", sentCfg.bg, sentCfg.color)}
                    >
                      <SentIcon className="h-3 w-3 mr-1" />
                      {sentCfg.label}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm text-slate-700 mb-3">{review.comment}</p>

                <div className="flex flex-wrap gap-1 mb-3">
                  {review.keywords.map((kw) => (
                    <Badge
                      key={kw}
                      variant="outline"
                      className="text-xs"
                    >
                      {kw}
                    </Badge>
                  ))}
                </div>

                {review.response && (
                  <div className="bg-slate-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      Votre réponse :
                    </p>
                    <p className="text-sm">{review.response}</p>
                  </div>
                )}

                {review.aiSuggestion && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3">
                    <p className="text-xs text-indigo-600 font-medium mb-1">
                      Suggestion IA :
                    </p>
                    <p className="text-sm">{review.aiSuggestion}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() =>
                        navigator.clipboard.writeText(review.aiSuggestion!)
                      }
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copier
                    </Button>
                  </div>
                )}

                {!review.response && !review.aiSuggestion && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateReply(review.id)}
                    disabled={loadingId === review.id}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    {loadingId === review.id
                      ? "Génération..."
                      : "Suggérer une réponse IA"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
