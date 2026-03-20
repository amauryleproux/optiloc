"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  errors: string[];
}

export default function SettingsPage() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/sync/csv", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'import");
      } else {
        setResult(data);
      }
    } catch {
      setError("Erreur réseau lors de l'upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleIcalSync() {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const res = await fetch("/api/sync/ical", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(`Sync réussie : ${data.imported || 0} réservations importées, ${data.updated || 0} mises à jour.`);
      } else {
        setSyncMessage(data.error || "Erreur lors de la synchronisation");
      }
    } catch {
      setSyncMessage("Erreur réseau");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-muted-foreground mt-1">
          Gérez vos données et synchronisations
        </p>
      </div>

      {/* CSV Import */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <FileText className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Import CSV Airbnb</h2>
            <p className="text-sm text-muted-foreground">
              Importez vos revenus réels depuis l&apos;export CSV Airbnb
            </p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600 space-y-2">
          <p className="font-medium text-slate-700">Comment exporter depuis Airbnb :</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Allez sur votre tableau de bord Airbnb</li>
            <li>Cliquez sur &quot;Historique des transactions&quot;</li>
            <li>Sélectionnez la période souhaitée</li>
            <li>Cliquez sur &quot;Exporter en CSV&quot;</li>
          </ol>
          <p className="text-xs text-slate-500 mt-2">
            Formats supportés : CSV Airbnb (FR/EN). Colonnes attendues : dates d&apos;arrivée/départ, montant, frais de ménage, versement hôte.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <label
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm cursor-pointer transition-colors ${
              uploading
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Import en cours..." : "Choisir un fichier CSV"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <CheckCircle className="h-5 w-5" />
              Import terminé
            </div>
            <div className="text-sm text-green-600 space-y-1">
              <p>{result.imported} nouvelles réservations importées</p>
              <p>{result.updated} réservations mises à jour avec revenus réels</p>
              {result.skipped > 0 && (
                <p className="text-slate-500">{result.skipped} lignes ignorées (annulées ou invalides)</p>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="text-xs text-amber-600 mt-2">
                {result.errors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700 font-medium">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          </div>
        )}
      </div>

      {/* iCal Sync */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Synchronisation iCal</h2>
            <p className="text-sm text-muted-foreground">
              Synchronisez les réservations depuis votre calendrier Airbnb
            </p>
          </div>
        </div>

        <button
          onClick={handleIcalSync}
          disabled={syncing}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
            syncing
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Synchronisation..." : "Synchroniser maintenant"}
        </button>

        {syncMessage && (
          <p className="text-sm text-slate-600">{syncMessage}</p>
        )}
      </div>
    </div>
  );
}
