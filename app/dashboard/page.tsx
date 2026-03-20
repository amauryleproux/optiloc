"use client";

import { useEffect, useState } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { OccupancyChart } from "@/components/dashboard/OccupancyCalendar";
import { PricingAlert } from "@/components/dashboard/PricingAlert";
import { DollarSign, Percent, Home, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { KPIData, DashboardAlert } from "@/types";

interface DashboardData {
  kpis: KPIData;
  revenueChart: { month: string; revenue: number }[];
  occupancyChart: { week: string; rate: number }[];
  alerts: DashboardAlert[];
  listing: { title: string; city: string; lastSyncAt: string | null };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setError("Impossible de charger les données");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[380px] rounded-xl" />
          <Skeleton className="h-[380px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {error || "Aucune donnée disponible"}
      </div>
    );
  }

  const { kpis, revenueChart, occupancyChart, alerts } = data;

  const revenueChange =
    ((kpis.revenue - kpis.revenuePrevMonth) / kpis.revenuePrevMonth) * 100;
  const occChange = kpis.occupancyRate - kpis.occupancyPrevMonth;
  const priceChange =
    ((kpis.avgPricePerNight - kpis.avgPricePrevMonth) /
      kpis.avgPricePrevMonth) *
    100;
  const ratingChange =
    ((kpis.avgRating - kpis.ratingPrevMonth) / (kpis.ratingPrevMonth || 1)) * 100;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Revenus du mois"
          value={kpis.revenue.toLocaleString("fr-FR")}
          change={revenueChange}
          icon={DollarSign}
          suffix="€"
        />
        <KPICard
          title="Taux d'occupation"
          value={kpis.occupancyRate.toString()}
          change={occChange}
          icon={Percent}
          suffix="%"
        />
        <KPICard
          title="Prix moyen/nuit"
          value={kpis.avgPricePerNight.toString()}
          change={priceChange}
          icon={Home}
          suffix="€"
        />
        <KPICard
          title="Note moyenne"
          value={kpis.avgRating.toFixed(1)}
          change={ratingChange}
          icon={Star}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={revenueChart} />
        <OccupancyChart data={occupancyChart} />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            Alertes & recommandations
          </h2>
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <PricingAlert key={i} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Revenue disclaimer */}
      <p className="text-xs text-muted-foreground italic">
        * Les revenus affichés sont estimés à partir du calendrier iCal et des
        règles de pricing. Pour les montants réels, consultez votre tableau de
        bord Airbnb.
        {data.listing.lastSyncAt && (
          <> — Dernière sync : {new Date(data.listing.lastSyncAt).toLocaleString("fr-FR")}</>
        )}
      </p>
    </div>
  );
}
