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
import { Star, Building2, Home } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function CompetitorTable({ data, myPrice }: { data: CompetitorRow[]; myPrice: number }) {
  const airbnbData = data.filter((d) => d.source === "airbnb");
  const hotelData = data.filter((d) => d.source === "hotel");

  return (
    <div className="space-y-6">
      {airbnbData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="h-4 w-4 text-rose-500" />
              Logements Airbnb concurrents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CompetitorRows data={airbnbData} />
          </CardContent>
        </Card>
      )}

      {hotelData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              Hôtels aux alentours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CompetitorRows data={hotelData} />
          </CardContent>
        </Card>
      )}

      {data.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun concurrent trouvé. Configurez vos clés API (APIFY_API_TOKEN, SERPAPI_API_KEY) et lancez un scraping.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CompetitorRows({ data }: { data: CompetitorRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Logement</TableHead>
          <TableHead>Note</TableHead>
          <TableHead>Avis</TableHead>
          <TableHead>Ce soir</TableHead>
          <TableHead>Week-end</TableHead>
          <TableHead>24h Mans</TableHead>
          <TableHead className="text-right">Écart</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((comp) => (
          <TableRow key={comp.id}>
            <TableCell className="font-medium max-w-[200px] truncate">
              {comp.externalUrl ? (
                <a
                  href={comp.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-indigo-600"
                >
                  {comp.name}
                </a>
              ) : (
                comp.name
              )}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-sm">{comp.rating.toFixed(1)}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm">{comp.reviewCount}</TableCell>
            <TableCell className="font-mono text-sm">
              {comp.priceTonight}€
            </TableCell>
            <TableCell className="font-mono text-sm">
              {comp.priceWeekend}€
            </TableCell>
            <TableCell className="font-mono text-sm font-bold">
              {comp.price24h}€
            </TableCell>
            <TableCell className="text-right">
              <Badge
                variant="secondary"
                className={cn(
                  "font-mono",
                  comp.diffPercent > 0
                    ? "bg-red-100 text-red-700"
                    : comp.diffPercent < 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100"
                )}
              >
                {comp.diffPercent > 0 ? "+" : ""}
                {comp.diffPercent}%
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
