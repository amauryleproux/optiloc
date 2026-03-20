"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardAlert } from "@/types";

const alertConfig = {
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50 border-amber-200",
    iconColor: "text-amber-500",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-500",
  },
  success: {
    icon: CheckCircle,
    bg: "bg-emerald-50 border-emerald-200",
    iconColor: "text-emerald-500",
  },
  danger: {
    icon: XCircle,
    bg: "bg-red-50 border-red-200",
    iconColor: "text-red-500",
  },
};

export function PricingAlert({ alert }: { alert: DashboardAlert }) {
  const config = alertConfig[alert.type];
  const Icon = config.icon;

  return (
    <Card className={cn("border", config.bg)}>
      <CardContent className="flex items-start gap-3 py-3">
        <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", config.iconColor)} />
        <div>
          <p className="font-medium text-sm text-slate-900">{alert.title}</p>
          <p className="text-sm text-slate-600 mt-0.5">{alert.message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
