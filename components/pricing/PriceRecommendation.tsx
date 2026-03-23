"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { PriceRecommendation as PriceRec } from "@/types";

interface Props {
  recommendations: PriceRec[];
}

export function PriceRecommendationTable({ recommendations }: Props) {
  const actionable = recommendations.filter(
    (r) => !r.isBooked && r.recommendedPrice !== r.basePrice
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recommandations de prix</CardTitle>
        <Badge variant="secondary">{actionable.length} ajustements suggérés</Badge>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Prix base</TableHead>
              <TableHead>Prix suggéré</TableHead>
              <TableHead>Facteurs</TableHead>
              <TableHead>Demande</TableHead>
              <TableHead className="text-right">Variation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recommendations.slice(0, 14).map((rec) => {
              const diff = rec.recommendedPrice - rec.basePrice;
              const pctChange = ((diff / rec.basePrice) * 100).toFixed(0);
              const topFactor = rec.factors.length > 0
                ? rec.factors.reduce((a, b) =>
                    Math.abs(b.multiplier - 1) > Math.abs(a.multiplier - 1) ? b : a
                  )
                : null;

              return (
                <TableRow
                  key={rec.date}
                  className={cn(
                    rec.isBooked && "opacity-50",
                    rec.isOrphan && "bg-amber-50/50"
                  )}
                >
                  <TableCell className="font-medium">
                    <div>
                      {format(new Date(rec.date), "EEE dd MMM", { locale: fr })}
                    </div>
                    {rec.isBooked && (
                      <Badge variant="secondary" className="text-[10px] mt-0.5">
                        Réservé
                      </Badge>
                    )}
                    {rec.isOrphan && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] mt-0.5 bg-amber-100 text-amber-700"
                      >
                        Orpheline
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">{rec.basePrice}€</TableCell>
                  <TableCell className="font-mono font-bold">
                    {rec.recommendedPrice}€
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-sm text-muted-foreground truncate block cursor-help">
                            {topFactor
                              ? `${topFactor.name} (${topFactor.multiplier > 1 ? "+" : ""}${Math.round((topFactor.multiplier - 1) * 100)}%)`
                              : "—"}
                            {rec.factors.length > 1
                              ? ` +${rec.factors.length - 1}`
                              : ""}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <div className="space-y-1">
                            {rec.factors.map((f, i) => (
                              <div key={i} className="text-xs">
                                <span className="font-medium">{f.name}</span>:{" "}
                                {f.description} (
                                {f.multiplier > 1 ? "+" : ""}
                                {Math.round((f.multiplier - 1) * 100)}%)
                              </div>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${rec.demandScore}%`,
                            backgroundColor:
                              rec.demandScore >= 70
                                ? "#10b981"
                                : rec.demandScore >= 40
                                ? "#f59e0b"
                                : "#ef4444",
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        {rec.demandScore}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "font-mono",
                        diff > 0
                          ? "bg-emerald-100 text-emerald-700"
                          : diff < 0
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {diff > 0 ? "+" : ""}
                      {pctChange}%
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
