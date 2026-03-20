"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ComparisonData {
  date: string;
  myPrice: number;
  avgCompetitor: number;
}

export function PriceComparisonChart({ data }: { data: ComparisonData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Mon prix vs moyenne concurrents (30 jours)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: "#64748b" }}
              />
              <YAxis className="text-xs" tick={{ fill: "#64748b" }} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value}€`,
                  name === "myPrice" ? "Mon prix" : "Moyenne concurrents",
                ]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              />
              <Legend
                formatter={(value: string) =>
                  value === "myPrice" ? "Mon prix" : "Moyenne concurrents"
                }
              />
              <Line
                type="monotone"
                dataKey="myPrice"
                stroke="#4F46E5"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="avgCompetitor"
                stroke="#F59E0B"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
