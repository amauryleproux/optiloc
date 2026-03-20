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
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { PriceRecommendation as PriceRec } from "@/types";

interface Props {
  recommendations: PriceRec[];
}

export function PriceRecommendationTable({ recommendations }: Props) {
  const actionable = recommendations.filter(
    (r) => r.isAvailable && r.recommendedPrice !== r.basePrice
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recommandations de prix</CardTitle>
        <Button size="sm" disabled={actionable.length === 0}>
          Appliquer toutes ({actionable.length})
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Prix actuel</TableHead>
              <TableHead>Prix suggéré</TableHead>
              <TableHead>Raison</TableHead>
              <TableHead className="text-right">Variation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recommendations.slice(0, 14).map((rec) => {
              const diff = rec.recommendedPrice - rec.basePrice;
              const pct = ((diff / rec.basePrice) * 100).toFixed(0);
              return (
                <TableRow key={rec.date.toString()}>
                  <TableCell className="font-medium">
                    {format(new Date(rec.date), "EEE dd MMM", { locale: fr })}
                  </TableCell>
                  <TableCell className="font-mono">{rec.basePrice}€</TableCell>
                  <TableCell className="font-mono font-bold">
                    {rec.recommendedPrice}€
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {rec.reasoning}
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
                      {pct}%
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
