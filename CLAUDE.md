@AGENTS.md

# OptilLoc - Dashboard de gestion locative Airbnb

Application Next.js 16 pour optimiser la gestion et la tarification d'un logement Airbnb au Mans.

## Stack technique

- **Framework** : Next.js 16.2.0 + React 19 + TypeScript
- **Base de donnees** : PostgreSQL via Prisma ORM
- **Auth/Storage** : Supabase
- **Cache** : Upstash Redis
- **IA** : Anthropic Claude (audit annonce + reponses avis)
- **Scraping** : API Airbnb directe (v2/v3) + SerpApi (hotels)
- **UI** : Tailwind CSS + shadcn/ui + Recharts
- **Deploy** : Vercel avec cron jobs

## Architecture

```
app/
  page.tsx                          # Redirect vers /dashboard
  layout.tsx                        # Layout racine (Geist fonts)
  dashboard/
    layout.tsx                      # Shell dashboard (Sidebar + TopBar)
    page.tsx                        # Dashboard principal (KPIs, graphiques, alertes)
    pricing/page.tsx                # Moteur de prix (calendrier 60j + regles)
    competitors/page.tsx            # Analyse concurrents (Airbnb + hotels)
    listing/page.tsx                # Audit IA de l'annonce (score /100)
    reviews/page.tsx                # Gestion avis + reponses IA
    settings/page.tsx               # Import CSV + sync iCal
  api/
    dashboard/route.ts              # GET: KPIs, graphiques revenus/occupation, alertes
    sync/
      csv/route.ts                  # POST: Import CSV Airbnb (revenus reels)
      ical/route.ts                 # POST: Sync calendrier iCal
      cron/route.ts                 # GET: Router cron jobs Vercel
    competitors/
      route.ts                      # GET: Donnees concurrents + comparaison
      scrape/route.ts               # POST: Scraping concurrents (Airbnb + hotels)
    pricing/
      recommendations/route.ts      # GET: Recommandations prix 60 jours
      rules/route.ts                # GET/POST/PATCH: CRUD regles de pricing
    ai/
      listing-audit/route.ts        # POST: Audit IA de l'annonce via Claude
      review-reply/route.ts         # POST: Generation reponse avis via Claude

components/
  layout/
    Sidebar.tsx                     # Navigation laterale fixe
    TopBar.tsx                      # Barre superieure
  dashboard/
    KPICard.tsx                     # Carte KPI avec % evolution
    RevenueChart.tsx                # Graphique revenus 12 mois (BarChart)
    OccupancyCalendar.tsx           # Graphique occupation 8 semaines
    PricingAlert.tsx                # Alertes (warning/info/success/danger)
  pricing/
    PriceCalendar.tsx               # Calendrier interactif 60 jours
    PriceRecommendation.tsx         # Tableau previsions 14 jours
    PricingRuleCard.tsx             # Carte regle avec toggle on/off
  competitors/
    CompetitorTable.tsx             # Tableau concurrents avec prix
    PriceComparisonChart.tsx        # Graphique comparaison 30 jours
  ui/                               # Composants shadcn/ui

lib/
  prisma.ts                         # Singleton PrismaClient
  anthropic.ts                      # Client Claude + prompts systeme (audit + avis)
  supabase.ts                       # Client Supabase
  redis.ts                          # Client Upstash Redis
  ical-parser.ts                    # Parsing iCal + estimation revenus
  pricing-engine.ts                 # Algorithme de tarification dynamique
  scraper/
    index.ts                        # Orchestrateur (Airbnb + hotels en parallele)
    airbnb-competitor.ts            # Scraper API Airbnb v2/v3
    hotel-scraper.ts                # Scraper SerpApi + fallback hotels hardcodes

prisma/
  schema.prisma                     # 8 modeles: Listing, Booking, PricingRule,
                                    # Competitor, CompetitorPrice, Review,
                                    # ListingScore, Event

scripts/
  seed.ts                           # Seeding DB (listing, regles, concurrents, bookings)
  update-events-rules.ts            # Mise a jour evenements 2026 + regles pricing

types/
  index.ts                          # Types: PriceRecommendation, CompetitorData,
                                    # ListingAuditResult, ReviewReplyResult, KPIData
```

## Modele de donnees (Prisma)

| Modele | Role |
|---|---|
| **Listing** | Logement (1 seul par user) : titre, adresse, prix base/min/max, icalUrl |
| **Booking** | Reservations : checkIn/Out, prix/nuit, revenu total, hostPayout, revenueSource (csv\|estimated) |
| **PricingRule** | Regles tarification : type (event\|season\|day_of_week\|occupancy\|last_minute), modifier |
| **Competitor** | Concurrents : source (airbnb\|hotel), externalId, rating, reviewCount |
| **CompetitorPrice** | Prix concurrents par date |
| **Review** | Avis : rating, sentiment, keywords, aiSuggestion |
| **ListingScore** | Score audit IA : total/100, sous-scores /25, suggestions |
| **Event** | Evenements Le Mans : 24h, MotoGP, etc. avec niveau d'impact |

## Flux principaux

### 1. Synchronisation des reservations

```
iCal (horaire)  -->  Bookings "estimated" (revenus estimes)
CSV (manuel)    -->  Bookings "csv" (revenus reels, source de verite)
                     Match par confirmation code ou proximite de dates
                     Le CSV ecrase les estimations iCal
```

**Calcul des revenus CSV** :
- `hostPayout` = colonne "Montant" (revenu net recu)
- `pricePerNight` = (Revenus bruts - Frais de menage) / Nuits
- `cleaningFee` = colonne "Frais de menage"
- Filtre : uniquement les lignes Type === "Reservation"

### 2. Moteur de tarification dynamique (v2)

Objectif : maximiser le RevPAN = ADR x Taux d'occupation.
Classe `PricingEngine` dans `lib/pricing-engine.ts`.

#### Architecture

L'engine est une classe pure (pas de dependance Prisma directe).
Instanciation via `createEngineFromPrisma(listing, bookings, events, competitors, rules)`.

API publique :
- `generateRecommendations(days=60)` → PriceRecommendation[]
- `getPriceForDate(date)` → PriceRecommendation
- `projectRevenue(days=60, historicalOccupancy)` → RevenueProjection

#### 8 facteurs combines (par ordre de priorite)

| # | Facteur | Multiplicateur | Source donnees |
|---|---|---|---|
| 1 | **Evenements locaux** | x1.2 a x3.5 | Table `Event` (impact: maximum/very_high/high/medium/low) |
| 2 | **Saison** | x0.82 a x1.50 | Mois calendaire (juin=pic x1.50, hiver x0.82) |
| 3 | **Jour de la semaine** | x0.85 a x1.28 | Samedi x1.28, vendredi x1.22, lundi-mardi x0.85 |
| 4 | **Pression d'occupation** | x0.87 a x1.18 | Fenetre ±7j autour de la date (% nuits reservees) |
| 5 | **Courbe de pickup** | x0.65 a x1.05 | Interpolation lineaire J-90 a J+0 (sweet spot J-14 a J-30) |
| 6 | **Concurrents** | x0.90 ou x1.08 | Mediane prix concurrents du jour (si >3 data points) |
| 7 | **Nuits orphelines** | x0.85 a x0.95 | Detecte gaps 1-5 nuits entre reservations |
| 8 | **Regles manuelles** | variable | Table `PricingRule` (seules les regles non-natives) |

#### Detail des constantes calibrees (Le Mans)

**Evenements** (source: donnees Likibu) :
- `maximum` = x3.50 (24H du Mans — prix median marche 474€ vs 131€ base)
- `very_high` = x2.80 (GP France MotoGP)
- `high` = x2.20 (24H Motos, Le Mans Classic)
- `medium` = x1.45 (Nuit des Chimeres, Foire du Mans)
- `low` = x1.20 (evenements locaux mineurs)
- Fenetre d'influence : J-2 avant debut, J+1 apres fin (pre/post = 65% de la valeur)

**Saisons** :
- Juin x1.50 (pic evenementiel), Juil-aout x1.35, Printemps x1.15
- Automne x1.10, Inter-saison (mars/nov) x0.90, Hiver x0.82
- Si evenement actif : saison appliquee a 30% seulement (evite double-comptage)

**Courbe de pickup** (fenetre de reservation) :
- J+0 (meme jour) : x0.68, J-1 : x0.75, J-3 : x0.88, J-7 : x0.95
- J-14 : x1.00 (baseline), J-30 : x1.05 (prime anticipation)
- J-60 : x1.00, J-90 : x0.96
- Pendant evenement majeur (x>=2.5) : pas de remise last-minute

**Pression d'occupation locale** (fenetre ±7j) :
- >=85% occupe : x1.18 (periode saturee)
- 65-85% : neutre (pas d'ajustement)
- 45-65% : x0.94 (legere incitation)
- <45% : x0.87 (remise agressive)

**Positionnement concurrent** :
- Cible : median+12% ou P75*0.95 (le plus bas des deux)
- Si >30% au-dessus de la cible : x0.90 (repositionnement)
- Si >12% en-dessous : x1.08 (opportunite)
- Necessite au moins 3 data points pour s'activer

**Nuits orphelines** (gaps entre reservations) :
- Gap 1 nuit : -15% + minStay=1
- Gap 2 nuits : -10% + minStay=2
- Gap 3-5 nuits : -5%
- Detection : cherche nuit reservee avant et apres dans une fenetre de 5 jours

#### Sejour minimum dynamique

- Evenement x>=3.0 (24H du Mans) : 3 nuits min
- Evenement x>=2.0 : 2 nuits min
- Vendredi/samedi : 2 nuits min
- Reste : 1 nuit

#### Regles manuelles (table PricingRule)

Les types `event`, `season`, `occupancy`, `last_minute` sont ignores par `applyManualRules()`
car deja geres nativement par l'engine via les tables Event + constantes.
Seul le type `day_of_week` avec `daysOfWeek` (via conditions.days) est traite comme override.

#### Sortie

Chaque `PriceRecommendation` contient :
- `date` (YYYY-MM-DD), `basePrice`, `recommendedPrice` (clampe min/max)
- `factors[]` : detail de chaque facteur applique (name, type, multiplier, description)
- `demandScore` (0-100) : normalisation du multiplicateur total pour visualisation
- `confidence` (high/medium/low) : selon proximite + donnees concurrents/evenements
- `isOrphan` : nuit isolee entre reservations
- `minStay` : sejour minimum recommande

`RevenueProjection` :
- `projectedRevenue`, `projectedOccupancy`, `avgNightlyRate`
- `revenueByMonth`, `bestMonth`, `worstMonth`
- `vsCurrentScenario` : gain/perte vs prix fixe 70€/nuit a 69% occupation

### 3. Scraping concurrents

- **Airbnb** : API publique `/api/v2/explore_tabs` (fallback v3 GraphQL)
  - Extraction : ID (gestion precision grands nombres), nom, prix, rating, photo
- **Hotels** : SerpApi `google_hotels` (fallback : 8 hotels Le Mans hardcodes)
  - Weekend multiplier 1.15x
- Stockage en DB avec historique de prix par date

### 4. IA (Claude)

- **Audit annonce** : Score /100 (titre, description, photos, pricing chacun /25) + suggestions
- **Reponses avis** : Generation de reponses chaleureuses en francais (80-150 mots)
- Modele : Claude Haiku pour le cout

## Cron Jobs (Vercel)

| Frequence | Job | Endpoint |
|---|---|---|
| Toutes les heures | Sync iCal | `/api/sync/cron?job=ical` |
| 3h du matin | Scraping concurrents | `/api/sync/cron?job=competitors` |
| 4h du matin | Recalcul pricing | `/api/sync/cron?job=pricing` |
| 5h lundi | Audit annonce | `/api/sync/cron?job=listing-score` |

## Variables d'environnement

Voir `.env.example` pour la liste complete. Cles requises :
- `DATABASE_URL` / `DIRECT_URL` : PostgreSQL
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` : Auth
- `ANTHROPIC_API_KEY` : Claude IA
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` : Cache
- `AIRBNB_ICAL_URL` : URL calendrier iCal Airbnb
- `SERPAPI_API_KEY` : Scraping hotels

## Commandes

```bash
npx prisma generate          # Regenerer le client Prisma
npx prisma db push           # Appliquer le schema en DB
npx tsx scripts/seed.ts      # Seeder la base
npm run dev                  # Serveur dev (localhost:3000)
```
