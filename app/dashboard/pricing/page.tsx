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
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { CalendarDay, PriceRecommendation } from "@/types";

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
  historicalAvgPrice: number;
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

        // Transform recommendations into calendar days
        const calendar: CalendarDay[] = json.recommendations.map(
          (rec: PriceRecommendation) => ({
            date: new Date(rec.date),
            price: rec.basePrice,
            recommendedPrice: rec.recommendedPrice,
            isAvailable: rec.isAvailable,
            isBooked: !rec.isAvailable,
            appliedRules: rec.appliedRules,
          })
        );

        // Get rules
        const rulesRes = await fetch("/api/pricing/rules");
        const rulesData = rulesRes.ok ? await rulesRes.json() : { rules: [] };

        setData({
          calendar,
          recommendations: json.recommendations.map(
            (r: PriceRecommendation) => ({
              ...r,
              date: new Date(r.date),
            })
          ),
          rules: rulesData.rules || [],
          historicalAvgPrice: json.historicalAvgPrice || 0,
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
      // Update local state
      setData(
        (prev) =>
          prev && {
            ...prev,
            rules: prev.rules.map((r) =>
              r.id === id ? { ...r, active } : r
            ),
          }
      );
      // Refresh recommendations after rule change
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

  return (
    <div className="space-y-6">
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
                  <p className="text-sm text-muted-foreground">
                    Prix de base
                  </p>
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
              <div>
                <p className="text-sm text-muted-foreground mb-2">Statut</p>
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
              {selectedDay.appliedRules.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Règles appliquées
                  </p>
                  <div className="space-y-1">
                    {selectedDay.appliedRules.map((rule, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-sm bg-slate-50 p-2 rounded"
                      >
                        <span>{rule.name}</span>
                        <span className="font-mono">
                          {rule.modifier > 1 ? "+" : ""}
                          {Math.round((rule.modifier - 1) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
