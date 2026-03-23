"use client";

import { useState, useEffect, useCallback } from "react";
import { PriceCalendar } from "@/components/pricing/PriceCalendar";
import { PricingRuleCard } from "@/components/pricing/PricingRuleCard";
import { PriceRecommendationTable } from "@/components/pricing/PriceRecommendation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, TrendingUp, Calendar, Target } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { CalendarDay, PriceRecommendation, RevenueProjection } from "@/types";

interface PricingRule {
  id: string;
  name: string;
  type: string;
  modifier: number;
  active: boolean;
}

interface PricingData {
  calendar: CalendarDay[];
  recommendations: PriceRecommendation[];
  rules: PricingRule[];
  projection: RevenueProjection | null;
  occupancyRate: number;
  competitorAvg: number;
}

export default function PricingPage() {
  const [data, setData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/pricing/recommendations");
      if (res.ok) {
        const json = await res.json();

        const calendar: CalendarDay[] = json.recommendations.map(
          (rec: PriceRecommendation) => ({
            date: new Date(rec.date),
            price: rec.basePrice,
            recommendedPrice: rec.recommendedPrice,
            isAvailable: !rec.isBooked,
            isBooked: rec.isBooked ?? false,
            factors: rec.factors,
            demandScore: rec.demandScore,
            confidence: rec.confidence,
            isOrphan: rec.isOrphan,
            minStay: rec.minStay,
          })
        );

        const rulesRes = await fetch("/api/pricing/rules");
        const rulesData = rulesRes.ok ? await rulesRes.json() : { rules: [] };

        setData({
          calendar,
          recommendations: json.recommendations,
          rules: rulesData.rules || [],
          projection: json.projection || null,
          occupancyRate: json.occupancyRate || 0,
          competitorAvg: json.competitorAvg || 0,
        });
      }
    } catch (e) {
      console.error("Failed to load pricing data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleToggleRule(id: string, active: boolean) {
    try {
      await fetch("/api/pricing/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      setData(
        (prev) =>
          prev && {
            ...prev,
            rules: prev.rules.map((r) =>
              r.id === id ? { ...r, active } : r
            ),
          }
      );
      fetchData();
    } catch (e) {
      console.error("Failed to toggle rule", e);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const calendar = data?.calendar || [];
  const recommendations = data?.recommendations || [];
  const rules = data?.rules || [];
  const projection = data?.projection;

  return (
    <div className="space-y-6">
      {/* Revenue projection cards */}
      {projection && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Revenu projeté (60j)
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {projection.projectedRevenue}€
              </div>
              {projection.vsCurrentScenario !== 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span
                    className={
                      projection.vsCurrentScenario > 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }
                  >
                    {projection.vsCurrentScenario > 0 ? "+" : ""}
                    {projection.vsCurrentScenario}€
                  </span>{" "}
                  vs prix fixe
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Prix moyen/nuit
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {projection.avgNightlyRate}€
              </div>
              {data?.competitorAvg ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Concurrents : {data.competitorAvg}€/nuit
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Occupation projetée
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {projection.projectedOccupancy}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Actuel 30j : {data?.occupancyRate}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Meilleur mois
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {projection.revenueByMonth[projection.bestMonth]}€
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {projection.bestMonth}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="xl:col-span-2">
          <PriceCalendar
            days={calendar}
            onDayClick={(day) => setSelectedDay(day)}
          />
        </div>

        {/* Rules panel */}
        <div>
          <h2 className="text-base font-semibold mb-3">Règles de pricing</h2>
          {rules.length > 0 ? (
            <div className="space-y-2">
              {rules.map((rule) => (
                <PricingRuleCard
                  key={rule.id}
                  {...rule}
                  onToggle={handleToggleRule}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune règle configurée
            </p>
          )}
        </div>
      </div>

      {/* Recommendations table */}
      <PriceRecommendationTable recommendations={recommendations.slice(0, 14)} />

      {/* Day detail dialog */}
      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDay &&
                format(new Date(selectedDay.date), "EEEE dd MMMM yyyy", {
                  locale: fr,
                })}
            </DialogTitle>
          </DialogHeader>
          {selectedDay && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Prix de base</p>
                  <p className="text-2xl font-bold font-mono">
                    {selectedDay.price}€
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prix suggéré</p>
                  <p className="text-2xl font-bold font-mono text-indigo-600">
                    {selectedDay.recommendedPrice}€
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Statut</p>
                  <Badge
                    variant={selectedDay.isBooked ? "default" : "secondary"}
                  >
                    {selectedDay.isBooked
                      ? "Réservé"
                      : selectedDay.isAvailable
                      ? "Disponible"
                      : "Bloqué"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Demande</p>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${selectedDay.demandScore}%`,
                          backgroundColor:
                            selectedDay.demandScore >= 70
                              ? "#10b981"
                              : selectedDay.demandScore >= 40
                              ? "#f59e0b"
                              : "#ef4444",
                        }}
                      />
                    </div>
                    <span className="text-sm font-mono">
                      {selectedDay.demandScore}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Séjour min
                  </p>
                  <Badge variant="outline">
                    {selectedDay.minStay} nuit{selectedDay.minStay > 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>

              {selectedDay.isOrphan && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  Nuit orpheline — prix réduit pour combler le trou entre deux
                  réservations
                </div>
              )}

              {selectedDay.factors.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Facteurs appliqués
                  </p>
                  <div className="space-y-1">
                    {selectedDay.factors.map((factor, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-start text-sm bg-slate-50 p-2 rounded"
                      >
                        <div>
                          <span className="font-medium">{factor.name}</span>
                          <p className="text-xs text-muted-foreground">
                            {factor.description}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            factor.multiplier > 1
                              ? "bg-emerald-100 text-emerald-700"
                              : factor.multiplier < 1
                              ? "bg-red-100 text-red-700"
                              : ""
                          }
                        >
                          {factor.multiplier > 1 ? "+" : ""}
                          {Math.round((factor.multiplier - 1) * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge
                  variant="outline"
                  className={
                    selectedDay.confidence === "high"
                      ? "border-emerald-300 text-emerald-700"
                      : selectedDay.confidence === "medium"
                      ? "border-amber-300 text-amber-700"
                      : "border-slate-300 text-slate-500"
                  }
                >
                  Confiance {selectedDay.confidence === "high"
                    ? "haute"
                    : selectedDay.confidence === "medium"
                    ? "moyenne"
                    : "faible"}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
