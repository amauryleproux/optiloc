"use client";

import { usePathname } from "next/navigation";
import { Bell, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/pricing": "Moteur de prix",
  "/dashboard/competitors": "Analyse concurrents",
  "/dashboard/listing": "Score annonce",
  "/dashboard/reviews": "Gestion des avis",
};

export function TopBar() {
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const title = titles[pathname || ""] || "Dashboard";

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/sync/ical", { method: "POST" });
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", syncing && "animate-spin")}
            />
            {syncing ? "Sync..." : "Sync iCal"}
          </Button>
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-red-500">
              3
            </Badge>
          </Button>
        </div>
      </div>
    </header>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
