"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListingAuditResult } from "@/types";

const DEMO_AUDIT: ListingAuditResult = {
  scores: {
    title: 18,
    description: 15,
    photos: 20,
    pricing: 19,
  },
  totalScore: 72,
  suggestions: [
    {
      priority: "high",
      category: "title",
      current: "Appartement Le Mans Centre",
      suggested:
        'Charmant T2 lumineux - Centre historique Le Mans - Proche Gare TGV',
      impact:
        "Un titre descriptif avec mots-clés améliore le classement dans les recherches Airbnb de 40%",
    },
    {
      priority: "high",
      category: "description",
      current: "Description de 3 lignes seulement",
      suggested:
        "Ajoutez une description détaillée de 300+ mots avec les points forts, le quartier, les transports",
      impact:
        "Les annonces avec des descriptions longues ont un taux de conversion 25% supérieur",
    },
    {
      priority: "medium",
      category: "photos",
      current: "12 photos",
      suggested:
        "Ajoutez 8 photos supplémentaires pour atteindre l'idéal de 20+",
      impact:
        "Les annonces avec 20+ photos reçoivent 30% de clics en plus",
    },
    {
      priority: "low",
      category: "amenities",
      current: "Pas de mention de la Sarthe",
      suggested:
        "Mentionnez la proximité avec la Sarthe et le Vieux-Mans dans votre description",
      impact:
        "Les voyageurs recherchent souvent des logements proches des attractions locales",
    },
  ],
  titleSuggestions: [
    "Charmant T2 lumineux - Cœur du Mans historique",
    "Appartement rénové - 5min Gare TGV - Wifi fibre",
    "Cocon urbain au Mans - Idéal 24h / city break",
  ],
  descriptionHook:
    "Niché au cœur du Mans historique, cet appartement lumineux vous offre le point de départ idéal pour explorer la Sarthe...",
};

const priorityConfig = {
  high: { label: "Haute", color: "bg-red-100 text-red-700", dot: "bg-red-500" },
  medium: { label: "Moyenne", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  low: { label: "Faible", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
};

const scoreLabels = [
  { key: "title" as const, label: "Titre", max: 25 },
  { key: "description" as const, label: "Description", max: 25 },
  { key: "photos" as const, label: "Photos", max: 25 },
  { key: "pricing" as const, label: "Prix", max: 25 },
];

export default function ListingPage() {
  const [audit, setAudit] = useState<ListingAuditResult | null>(DEMO_AUDIT);
  const [loading, setLoading] = useState(false);

  async function handleGenerateAudit() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/listing-audit", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setAudit(data);
      }
    } catch (e) {
      console.error("Audit failed", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Score global */}
      <Card>
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div
                className={cn(
                  "h-24 w-24 rounded-full flex items-center justify-center text-3xl font-bold font-mono border-4",
                  audit && audit.totalScore >= 80
                    ? "border-emerald-500 text-emerald-600"
                    : audit && audit.totalScore >= 60
                    ? "border-amber-500 text-amber-600"
                    : "border-red-500 text-red-600"
                )}
              >
                {audit?.totalScore || "—"}
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold">Score de votre annonce</h2>
              <p className="text-muted-foreground text-sm">
                {audit && audit.totalScore >= 80
                  ? "Excellent ! Votre annonce est bien optimisée."
                  : audit && audit.totalScore >= 60
                  ? "Correct, mais des améliorations sont possibles."
                  : "Des optimisations sont nécessaires pour améliorer vos résultats."}
              </p>
            </div>
          </div>
          <Button onClick={handleGenerateAudit} disabled={loading}>
            <Sparkles className="h-4 w-4 mr-2" />
            {loading ? "Analyse en cours..." : "Générer avec l'IA"}
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      )}

      {audit && !loading && (
        <>
          {/* Score breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scoreLabels.map(({ key, label, max }) => (
              <Card key={key}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-sm font-mono font-bold">
                      {audit.scores[key]}/{max}
                    </span>
                  </div>
                  <Progress
                    value={(audit.scores[key] / max) * 100}
                    className="h-2"
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Suggestions d&apos;optimisation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {audit.suggestions.map((s, i) => {
                const config = priorityConfig[s.priority];
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full mt-2 shrink-0",
                          config.dot
                        )}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="secondary"
                            className={cn("text-xs", config.color)}
                          >
                            {config.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {s.category}
                          </Badge>
                        </div>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Actuel :</span>{" "}
                          {s.current}
                        </p>
                        <p className="text-sm font-medium">
                          <span className="text-muted-foreground">
                            Suggestion :
                          </span>{" "}
                          {s.suggested}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {s.impact}
                        </p>
                      </div>
                    </div>
                    {i < audit.suggestions.length - 1 && <Separator />}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Title suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Suggestions de titres alternatifs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {audit.titleSuggestions.map((title, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <p className="text-sm font-medium">{title}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(title)}
                  >
                    Copier
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
