"use client";

import { useState, useEffect, useCallback } from "react";
import { CompetitorTable } from "@/components/competitors/CompetitorTable";
import { PriceComparisonChart } from "@/components/competitors/PriceComparisonChart";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react";

interface CompetitorRow {
  id: string;
  name: string;
  source: string;
  rating: number;
  reviewCount: number;
  priceTonight: number;
  priceWeekend: number;
  price24h: number;
  diffPercent: number;
  externalUrl?: string;
}

interface ComparisonData {
  date: string;
  myPrice: number;
  avgCompetitor: number;
}

interface CompetitorsData {
  competitors: CompetitorRow[];
  comparisonChart: ComparisonData[];
  myPrice: number;
}

export default function CompetitorsPage() {
  const [data, setData] = useState<CompetitorsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/competitors");
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error("Failed to load competitors", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleScrape() {
    setScraping(true);
    try {
      const res = await fetch("/api/competitors/scrape", { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        // Reload data after scrape
        await fetchData();
        alert(
          `Scraping terminé : ${result.airbnb || 0} Airbnb + ${result.hotels || 0} hôtels trouvés`
        );
      } else {
        alert(result.error || "Erreur lors du scraping");
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setScraping(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const competitors = data?.competitors || [];
  const myPrice = data?.myPrice || 75;
  const avgCompetitorPrice =
    competitors.length > 0
      ? Math.round(
          competitors.reduce((s, c) => s + c.priceTonight, 0) /
            competitors.length
        )
      : 0;
  const diffFromMedian =
    avgCompetitorPrice > 0
      ? Math.round(
          ((myPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Position indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            {diffFromMedian > 0 ? (
              <TrendingUp className="h-8 w-8 text-amber-500" />
            ) : (
              <TrendingDown className="h-8 w-8 text-emerald-500" />
            )}
            <div>
              <p className="text-sm text-muted-foreground">
                Positionnement marché
              </p>
              {competitors.length > 0 ? (
                <p className="font-semibold">
                  Vous êtes{" "}
                  <span
                    className={
                      diffFromMedian > 0
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }
                  >
                    {Math.abs(diffFromMedian)}%{" "}
                    {diffFromMedian > 0 ? "plus cher" : "moins cher"}
                  </span>{" "}
                  que la médiane du marché
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Lancez un scraping pour comparer vos prix
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Concurrents suivis
              </p>
              <p className="text-2xl font-bold">{competitors.length}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleScrape}
              disabled={scraping}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${scraping ? "animate-spin" : ""}`}
              />
              {scraping ? "Scraping..." : "Actualiser"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Comparison chart */}
      {data?.comparisonChart && data.comparisonChart.length > 0 && (
        <PriceComparisonChart data={data.comparisonChart} />
      )}

      {/* Competitor table */}
      <CompetitorTable data={competitors} myPrice={myPrice} />
    </div>
  );
}
