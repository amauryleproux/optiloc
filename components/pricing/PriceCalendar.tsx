"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { CalendarDay } from "@/types";

interface PriceCalendarProps {
  days: CalendarDay[];
  onDayClick?: (day: CalendarDay) => void;
}

export function PriceCalendar({ days, onDayClick }: PriceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  // Adjust for Monday start (European)
  const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  function getDayData(date: Date): CalendarDay | undefined {
    return days.find(
      (d) => format(d.date, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    );
  }

  function getPriceColor(day: CalendarDay): string {
    if (day.isBooked) return "bg-indigo-100 text-indigo-700 border-indigo-200";
    if (!day.isAvailable) return "bg-slate-100 text-slate-400";
    const ratio = day.recommendedPrice
      ? day.price / day.recommendedPrice
      : 1;
    if (ratio <= 0.95) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (ratio >= 1.15) return "bg-red-50 text-red-700 border-red-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Calendrier des prix</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {format(currentMonth, "MMMM yyyy", { locale: fr })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
          {/* Empty cells for offset */}
          {[...Array(offset)].map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {daysInMonth.map((date) => {
            const dayData = getDayData(date);
            return (
              <button
                key={date.toISOString()}
                onClick={() => dayData && onDayClick?.(dayData)}
                className={cn(
                  "relative p-1 rounded-lg border text-center min-h-[60px] transition-colors hover:ring-2 hover:ring-indigo-300",
                  dayData ? getPriceColor(dayData) : "bg-white border-slate-200",
                  isToday(date) && "ring-2 ring-indigo-500"
                )}
              >
                <div className="text-xs font-medium">{format(date, "d")}</div>
                {dayData && (
                  <>
                    <div className="text-sm font-bold font-mono mt-0.5">
                      {dayData.price}€
                    </div>
                    {dayData.isBooked && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 mt-0.5"
                      >
                        Réservé
                      </Badge>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" />
            Compétitif
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />
            Moyen
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
            Élevé
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-indigo-100 border border-indigo-200" />
            Réservé
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
