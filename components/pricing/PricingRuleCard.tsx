"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PricingRuleCardProps {
  id: string;
  name: string;
  type: string;
  modifier: number;
  active: boolean;
  onToggle: (id: string, active: boolean) => void;
}

const typeLabels: Record<string, { label: string; color: string }> = {
  event: { label: "Événement", color: "bg-purple-100 text-purple-700" },
  season: { label: "Saison", color: "bg-blue-100 text-blue-700" },
  day_of_week: { label: "Jour", color: "bg-cyan-100 text-cyan-700" },
  occupancy: { label: "Occupation", color: "bg-amber-100 text-amber-700" },
  last_minute: { label: "Last minute", color: "bg-red-100 text-red-700" },
  far_future: { label: "Long terme", color: "bg-slate-100 text-slate-700" },
};

export function PricingRuleCard({
  id,
  name,
  type,
  modifier,
  active,
  onToggle,
}: PricingRuleCardProps) {
  const typeInfo = typeLabels[type] || {
    label: type,
    color: "bg-slate-100 text-slate-700",
  };
  const isIncrease = modifier >= 1;
  const percentage = Math.round((modifier - 1) * 100);

  return (
    <Card className={cn(!active && "opacity-50")}>
      <CardContent className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <Switch
            checked={active}
            onCheckedChange={(checked) => onToggle(id, checked)}
          />
          <div>
            <p className="font-medium text-sm">{name}</p>
            <Badge variant="secondary" className={cn("text-xs mt-1", typeInfo.color)}>
              {typeInfo.label}
            </Badge>
          </div>
        </div>
        <span
          className={cn(
            "font-mono font-bold text-sm",
            isIncrease ? "text-emerald-600" : "text-red-600"
          )}
        >
          {isIncrease ? "+" : ""}
          {percentage}%
        </span>
      </CardContent>
    </Card>
  );
}
