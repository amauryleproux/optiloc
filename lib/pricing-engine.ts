/**
 * OptilLoc — Pricing Engine v2
 * ─────────────────────────────────────────────────────────────
 * Objectif : Maximiser le RevPAN = ADR × Taux d'occupation
 *
 * Philosophie :
 *   Monter trop haut  → nuits vides (pire cas)
 *   Rester trop bas   → manque à gagner
 *   Le sweet spot     → ajustement dynamique par 8 signaux combinés
 *
 * Ordre de priorité des facteurs :
 *   1. Événements locaux      (×2.2 à ×3.5)
 *   2. Saison                 (×0.85 à ×1.35)
 *   3. Jour de la semaine     (×0.85 à ×1.25)
 *   4. Pression d'occupation  (±20%)
 *   5. Courbe de pickup       (fenêtre de réservation)
 *   6. Concurrents            (repositionnement si écart >15%)
 *   7. Nuits orphelines       (combler les trous)
 *   8. Règles manuelles       (override utilisateur)
 */

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type FactorType =
  | 'event'
  | 'season'
  | 'dow'
  | 'occupancy'
  | 'pickup'
  | 'competitor'
  | 'orphan'
  | 'rule'

export interface PricingFactor {
  name: string
  type: FactorType
  multiplier: number
  description: string
}

export interface PriceRecommendation {
  date: string              // YYYY-MM-DD
  basePrice: number         // Prix de base configuré
  recommendedPrice: number  // Prix final recommandé (clampé min/max)
  minStay: number           // Séjour minimum recommandé (nuits)
  factors: PricingFactor[]  // Détail des facteurs appliqués
  demandScore: number       // Score demande 0-100 (visualisation)
  confidence: 'high' | 'medium' | 'low'
  isOrphan: boolean         // Nuit isolée entre deux réservations
}

export interface RevenueProjection {
  projectedRevenue: number
  projectedOccupancy: number   // %
  avgNightlyRate: number
  revenueByMonth: Record<string, number>
  bestMonth: string
  worstMonth: string
  vsCurrentScenario: number    // +/- € vs situation actuelle
}

export interface ListingConfig {
  basePrice: number
  minPrice: number
  maxPrice: number
}

export interface BookingSlot {
  checkIn: Date
  checkOut: Date
  pricePerNight?: number
  source?: 'csv' | 'ical' | 'estimated'
}

export interface EventConfig {
  name: string
  startDate: Date
  endDate: Date
  impact: 'maximum' | 'very_high' | 'high' | 'medium' | 'low'
}

export interface CompetitorPricePoint {
  date: Date
  price: number
  source: 'airbnb' | 'hotel'
}

export interface PricingRuleConfig {
  id: string
  type: 'event' | 'season' | 'day_of_week' | 'occupancy' | 'last_minute' | 'long_stay'
  enabled: boolean
  modifier: number
  conditions?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES CALIBRÉES POUR LE MANS
// ─────────────────────────────────────────────────────────────

const SEASON_CONFIG: Array<{ months: number[]; multiplier: number; label: string }> = [
  { months: [6],          multiplier: 1.50, label: 'Juin — pic événementiel' },
  { months: [7, 8],       multiplier: 1.35, label: 'Été (juil-août)' },
  { months: [4, 5],       multiplier: 1.15, label: 'Printemps — Haute épaule' },
  { months: [9, 10],      multiplier: 1.10, label: 'Automne — Basse épaule' },
  { months: [3, 11],      multiplier: 0.90, label: 'Inter-saison' },
  { months: [1, 2, 12],   multiplier: 0.82, label: 'Hiver — Basse saison' },
]

const DOW_CONFIG: Record<number, { multiplier: number; label: string }> = {
  0: { multiplier: 0.90, label: 'Dimanche' },
  1: { multiplier: 0.85, label: 'Lundi' },
  2: { multiplier: 0.85, label: 'Mardi' },
  3: { multiplier: 0.92, label: 'Mercredi' },
  4: { multiplier: 1.05, label: 'Jeudi' },
  5: { multiplier: 1.22, label: 'Vendredi' },
  6: { multiplier: 1.28, label: 'Samedi' },
}

const EVENT_IMPACT_MULTIPLIERS: Record<EventConfig['impact'], number> = {
  maximum:   3.50,
  very_high: 2.80,
  high:      2.20,
  medium:    1.45,
  low:       1.20,
}

const PICKUP_CURVE: Array<{ daysOut: number; multiplier: number }> = [
  { daysOut: -1, multiplier: 0.65 },
  { daysOut: 0,  multiplier: 0.68 },
  { daysOut: 1,  multiplier: 0.75 },
  { daysOut: 2,  multiplier: 0.82 },
  { daysOut: 3,  multiplier: 0.88 },
  { daysOut: 7,  multiplier: 0.95 },
  { daysOut: 14, multiplier: 1.00 },
  { daysOut: 21, multiplier: 1.03 },
  { daysOut: 30, multiplier: 1.05 },
  { daysOut: 45, multiplier: 1.03 },
  { daysOut: 60, multiplier: 1.00 },
  { daysOut: 90, multiplier: 0.96 },
]

// ─────────────────────────────────────────────────────────────
// CLASSE PRINCIPALE
// ─────────────────────────────────────────────────────────────

export class PricingEngine {
  private listing: ListingConfig
  private bookings: BookingSlot[]
  private events: EventConfig[]
  private competitorPrices: CompetitorPricePoint[]
  private rules: PricingRuleConfig[]

  constructor(
    listing: ListingConfig,
    bookings: BookingSlot[],
    events: EventConfig[],
    competitorPrices: CompetitorPricePoint[],
    rules: PricingRuleConfig[]
  ) {
    this.listing = listing
    this.bookings = bookings
    this.events = events
    this.competitorPrices = competitorPrices
    this.rules = rules.filter(r => r.enabled)
  }

  generateRecommendations(days = 60): PriceRecommendation[] {
    const today = startOfDay(new Date())
    const occupancyMap = this.buildOccupancyMap(days + 14)

    const recs: PriceRecommendation[] = []
    for (let i = 0; i < days; i++) {
      const date = addDays(today, i)
      recs.push(this.computePrice(date, occupancyMap))
    }

    return this.applyOrphanOptimization(recs, occupancyMap)
  }

  getPriceForDate(date: Date): PriceRecommendation {
    const occupancyMap = this.buildOccupancyMap(90)
    const recs = [this.computePrice(date, occupancyMap)]
    return this.applyOrphanOptimization(recs, occupancyMap)[0]
  }

  projectRevenue(days = 60, historicalOccupancy = 0.69): RevenueProjection {
    const recs = this.generateRecommendations(days)

    const nightRevenues = recs.map(rec => {
      const expectedOccupancy = Math.min(
        1.0,
        historicalOccupancy * (0.60 + (rec.demandScore / 100) * 0.70)
      )
      return rec.recommendedPrice * expectedOccupancy
    })

    const totalRevenue = nightRevenues.reduce((s, r) => s + r, 0)
    const avgRate = recs.reduce((s, r) => s + r.recommendedPrice, 0) / recs.length
    const avgOccupancy = nightRevenues.reduce((s, r, i) => s + r / recs[i].recommendedPrice, 0) / recs.length

    const revenueByMonth: Record<string, number> = {}
    recs.forEach((rec, i) => {
      const month = rec.date.substring(0, 7)
      revenueByMonth[month] = (revenueByMonth[month] ?? 0) + nightRevenues[i]
    })

    const months = Object.entries(revenueByMonth)
    const bestMonth = months.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
    const worstMonth = months.reduce((a, b) => (b[1] < a[1] ? b : a))[0]

    const currentRevenue = 70 * historicalOccupancy * days
    const vsCurrentScenario = Math.round(totalRevenue - currentRevenue)

    return {
      projectedRevenue: Math.round(totalRevenue),
      projectedOccupancy: Math.round(avgOccupancy * 100),
      avgNightlyRate: Math.round(avgRate),
      revenueByMonth: Object.fromEntries(
        Object.entries(revenueByMonth).map(([k, v]) => [k, Math.round(v)])
      ),
      bestMonth,
      worstMonth,
      vsCurrentScenario,
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CALCUL PRINCIPAL
  // ─────────────────────────────────────────────────────────────

  private computePrice(date: Date, occupancyMap: Map<string, boolean>): PriceRecommendation {
    const factors: PricingFactor[] = []
    let multiplier = 1.0

    // 1. ÉVÉNEMENTS
    const eventFactor = this.getEventFactor(date)
    if (eventFactor) {
      factors.push(eventFactor)
      multiplier *= eventFactor.multiplier
    }

    // 2. SAISON (poids réduit si événement actif)
    if (!eventFactor || eventFactor.type !== 'event') {
      const seasonFactor = this.getSeasonFactor(date)
      factors.push(seasonFactor)
      multiplier *= seasonFactor.multiplier
    } else {
      const seasonFactor = this.getSeasonFactor(date)
      const reducedFactor = { ...seasonFactor, multiplier: 1 + (seasonFactor.multiplier - 1) * 0.3 }
      factors.push(reducedFactor)
      multiplier *= reducedFactor.multiplier
    }

    // 3. JOUR DE LA SEMAINE
    const dowFactor = this.getDowFactor(date)
    factors.push(dowFactor)
    multiplier *= dowFactor.multiplier

    // 4. PRESSION D'OCCUPATION
    const occupancyFactor = this.getOccupancyPressureFactor(date, occupancyMap)
    if (occupancyFactor) {
      factors.push(occupancyFactor)
      multiplier *= occupancyFactor.multiplier
    }

    // 5. COURBE DE PICKUP (skip remise last-minute pendant événement majeur)
    const pickupFactor = this.getPickupFactor(date)
    if (!eventFactor || eventFactor.multiplier < 2.5 || pickupFactor.multiplier >= 1.0) {
      factors.push(pickupFactor)
      multiplier *= pickupFactor.multiplier
    }

    // 6. POSITIONNEMENT CONCURRENT
    const tentativePrice = this.listing.basePrice * multiplier
    const competitorFactor = this.getCompetitorFactor(date, tentativePrice)
    if (competitorFactor) {
      factors.push(competitorFactor)
      multiplier *= competitorFactor.multiplier
    }

    // 7. RÈGLES MANUELLES
    const ruleFactor = this.applyManualRules(date)
    if (ruleFactor) {
      factors.push(ruleFactor)
      multiplier *= ruleFactor.multiplier
    }

    // PRIX FINAL
    const rawPrice = Math.round(this.listing.basePrice * multiplier)
    const recommendedPrice = clamp(rawPrice, this.listing.minPrice, this.listing.maxPrice)

    return {
      date: dateKey(date),
      basePrice: this.listing.basePrice,
      recommendedPrice,
      minStay: this.computeMinStay(date, eventFactor),
      factors,
      demandScore: this.computeDemandScore(multiplier),
      confidence: this.computeConfidence(date, factors),
      isOrphan: false,
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FACTEURS
  // ─────────────────────────────────────────────────────────────

  private getEventFactor(date: Date): PricingFactor | null {
    for (const event of this.events) {
      const start = startOfDay(new Date(event.startDate))
      const end = startOfDay(new Date(event.endDate))
      const windowStart = addDays(start, -2)
      const windowEnd = addDays(end, 1)

      if (date >= windowStart && date <= windowEnd) {
        const baseMultiplier = EVENT_IMPACT_MULTIPLIERS[event.impact]
        const isMainPeriod = date >= start && date <= end
        const multiplier = isMainPeriod ? baseMultiplier : 1 + (baseMultiplier - 1) * 0.65

        return {
          name: event.name,
          type: 'event',
          multiplier: roundMult(multiplier),
          description: isMainPeriod
            ? `Événement majeur : ${event.name}`
            : `Pré/post ${event.name}`,
        }
      }
    }
    return null
  }

  private getSeasonFactor(date: Date): PricingFactor {
    const month = date.getMonth() + 1
    const config = SEASON_CONFIG.find(s => s.months.includes(month))!
    return {
      name: 'Saison',
      type: 'season',
      multiplier: config.multiplier,
      description: config.label,
    }
  }

  private getDowFactor(date: Date): PricingFactor {
    const dow = date.getDay()
    const config = DOW_CONFIG[dow]
    return {
      name: 'Jour de la semaine',
      type: 'dow',
      multiplier: config.multiplier,
      description: config.label,
    }
  }

  private getOccupancyPressureFactor(
    date: Date,
    occupancyMap: Map<string, boolean>
  ): PricingFactor | null {
    const WINDOW = 7
    let booked = 0
    let total = 0

    for (let i = -WINDOW; i <= WINDOW; i++) {
      const d = addDays(date, i)
      const key = dateKey(d)
      if (occupancyMap.has(key)) {
        total++
        if (occupancyMap.get(key)) booked++
      }
    }

    if (total < 5) return null
    const localOcc = booked / total

    if (localOcc >= 0.85) {
      return {
        name: 'Forte pression locale',
        type: 'occupancy',
        multiplier: 1.18,
        description: `Période saturée (${pct(localOcc)} des alentours réservés)`,
      }
    }
    if (localOcc >= 0.65) return null
    if (localOcc >= 0.45) {
      return {
        name: 'Légère sous-occupation',
        type: 'occupancy',
        multiplier: 0.94,
        description: `Période calme (${pct(localOcc)} occupé — légère incitation)`,
      }
    }
    return {
      name: 'Période creuse',
      type: 'occupancy',
      multiplier: 0.87,
      description: `Forte sous-occupation (${pct(localOcc)} — remise agressive pour remplir)`,
    }
  }

  private getPickupFactor(date: Date): PricingFactor {
    const today = startOfDay(new Date())
    const daysOut = Math.round((date.getTime() - today.getTime()) / MS_PER_DAY)
    const mult = interpolateCurve(PICKUP_CURVE, daysOut)

    let description: string
    if (daysOut <= 0)       description = 'Nuit passée / immédiate'
    else if (daysOut <= 1)  description = 'Dernière minute (J-1)'
    else if (daysOut <= 3)  description = 'Très court terme (J-3)'
    else if (daysOut <= 7)  description = 'Court terme (J-7)'
    else if (daysOut <= 14) description = 'Moyen terme (J-14)'
    else if (daysOut <= 30) description = 'Anticipation (J-30) — prime'
    else if (daysOut <= 60) description = 'Long terme (J-60)'
    else description = 'Très long terme (+60j)'

    return {
      name: 'Fenêtre de réservation',
      type: 'pickup',
      multiplier: roundMult(mult),
      description,
    }
  }

  private getCompetitorFactor(date: Date, currentPrice: number): PricingFactor | null {
    const key = dateKey(date)
    let prices = this.competitorPrices
      .filter(cp => dateKey(new Date(cp.date)) === key)
      .map(cp => cp.price)

    // Fallback: if no data for this exact date, use latest available data
    // (scraper only runs for today/tomorrow, so future dates have no data)
    if (prices.length < 3 && this.competitorPrices.length >= 3) {
      // Find the most recent date that has data
      const latestDate = this.competitorPrices.reduce((latest, cp) => {
        const d = new Date(cp.date)
        return d > latest ? d : latest
      }, new Date(0))
      const latestKey = dateKey(latestDate)
      if (latestKey !== key) {
        prices = this.competitorPrices
          .filter(cp => dateKey(new Date(cp.date)) === latestKey)
          .map(cp => cp.price)
      }
    }

    if (prices.length < 3) return null

    const sorted = [...prices].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const p75 = sorted[Math.floor(sorted.length * 0.75)]

    const targetPrice = Math.min(median * 1.12, p75 * 0.95)
    const deviation = (currentPrice - targetPrice) / targetPrice

    if (deviation > 0.30) {
      return {
        name: 'Repositionnement marché',
        type: 'competitor',
        multiplier: 0.90,
        description: `${Math.round(deviation * 100)}% au-dessus de la cible (médiane ${median}€)`,
      }
    }
    if (deviation < -0.12) {
      return {
        name: 'Opportunité marché',
        type: 'competitor',
        multiplier: 1.08,
        description: `Prix sous-évalué vs marché (médiane ${median}€ — cible ${Math.round(targetPrice)}€)`,
      }
    }
    return null
  }

  private applyManualRules(date: Date): PricingFactor | null {
    for (const rule of this.rules) {
      // Skip all types already handled natively by the engine
      if (rule.type === 'long_stay') continue
      if (rule.type === 'event') continue        // handled by getEventFactor via Event table
      if (rule.type === 'season') continue        // handled by getSeasonFactor
      if (rule.type === 'occupancy') continue     // handled by getOccupancyPressureFactor
      if (rule.type === 'last_minute') continue   // handled by getPickupFactor
      if (rule.type === 'day_of_week') continue   // handled by getDowFactor natively

      // Only truly custom rule types reach here
      return {
        name: `Règle manuelle (${rule.type})`,
        type: 'rule',
        multiplier: rule.modifier,
        description: `Override utilisateur — ×${rule.modifier}`,
      }
    }
    return null
  }

  // ─────────────────────────────────────────────────────────────
  // OPTIMISATION NUITS ORPHELINES
  // ─────────────────────────────────────────────────────────────

  private applyOrphanOptimization(
    recs: PriceRecommendation[],
    occupancyMap: Map<string, boolean>
  ): PriceRecommendation[] {
    return recs.map((rec, i) => {
      if (occupancyMap.get(rec.date)) return rec

      const gapSize = this.detectGapSize(i, recs, occupancyMap)
      if (gapSize === 0) return rec

      let discountMult: number
      let minStay: number
      let label: string

      if (gapSize === 1) {
        discountMult = 0.85
        minStay = 1
        label = 'Nuit orpheline isolée (-15%)'
      } else if (gapSize === 2) {
        discountMult = 0.90
        minStay = 2
        label = 'Fenêtre courte 2 nuits (-10%)'
      } else {
        discountMult = 0.95
        minStay = Math.min(3, gapSize)
        label = `Petit gap ${gapSize} nuits (-5%)`
      }

      const discountedPrice = Math.round(rec.recommendedPrice * discountMult)
      const finalPrice = Math.max(this.listing.minPrice, discountedPrice)

      return {
        ...rec,
        recommendedPrice: finalPrice,
        minStay,
        isOrphan: true,
        factors: [
          ...rec.factors,
          {
            name: 'Optimisation orpheline',
            type: 'orphan' as FactorType,
            multiplier: discountMult,
            description: label,
          },
        ],
      }
    })
  }

  private detectGapSize(
    index: number,
    recs: PriceRecommendation[],
    occupancyMap: Map<string, boolean>
  ): number {
    const MAX_GAP = 5

    let hasPrevBooked = false
    for (let j = index - 1; j >= Math.max(0, index - MAX_GAP); j--) {
      if (occupancyMap.get(recs[j].date)) {
        hasPrevBooked = true
        break
      } else if (j < index - 1) {
        break
      }
    }

    if (!hasPrevBooked) return 0

    let gapCount = 1
    for (let j = index + 1; j < Math.min(recs.length, index + MAX_GAP + 1); j++) {
      if (occupancyMap.get(recs[j].date)) {
        return gapCount <= MAX_GAP ? gapCount : 0
      }
      gapCount++
    }

    return 0
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  private buildOccupancyMap(days: number): Map<string, boolean> {
    const map = new Map<string, boolean>()
    const today = startOfDay(new Date())

    for (let i = 0; i < days; i++) {
      map.set(dateKey(addDays(today, i)), false)
    }

    for (const booking of this.bookings) {
      const checkIn = startOfDay(new Date(booking.checkIn))
      const checkOut = startOfDay(new Date(booking.checkOut))
      const current = new Date(checkIn)
      while (current < checkOut) {
        map.set(dateKey(current), true)
        current.setDate(current.getDate() + 1)
      }
    }

    return map
  }

  private computeMinStay(date: Date, eventFactor: PricingFactor | null): number {
    if (eventFactor) {
      if (eventFactor.multiplier >= 3.0) return 3
      if (eventFactor.multiplier >= 2.0) return 2
    }
    const dow = date.getDay()
    if (dow === 5 || dow === 6) return 2
    return 1
  }

  private computeDemandScore(multiplier: number): number {
    const MIN_MULT = 0.65
    const MAX_MULT = 3.50
    return Math.round(
      clamp(((multiplier - MIN_MULT) / (MAX_MULT - MIN_MULT)) * 100, 0, 100)
    )
  }

  private computeConfidence(date: Date, factors: PricingFactor[]): 'high' | 'medium' | 'low' {
    const today = new Date()
    const daysOut = Math.round((date.getTime() - today.getTime()) / MS_PER_DAY)
    const hasCompData = factors.some(f => f.type === 'competitor')
    const hasEvent = factors.some(f => f.type === 'event')

    if (daysOut <= 14 && (hasCompData || hasEvent)) return 'high'
    if (daysOut <= 30 && hasCompData) return 'high'
    if (daysOut <= 45) return 'medium'
    return 'low'
  }
}

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

const MS_PER_DAY = 1000 * 60 * 60 * 24

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundMult(mult: number): number {
  return Math.round(mult * 1000) / 1000
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

function interpolateCurve(
  curve: Array<{ daysOut: number; multiplier: number }>,
  daysOut: number
): number {
  if (daysOut <= curve[0].daysOut) return curve[0].multiplier
  if (daysOut >= curve[curve.length - 1].daysOut) return curve[curve.length - 1].multiplier

  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i]
    const b = curve[i + 1]
    if (daysOut >= a.daysOut && daysOut <= b.daysOut) {
      const t = (daysOut - a.daysOut) / (b.daysOut - a.daysOut)
      return a.multiplier + t * (b.multiplier - a.multiplier)
    }
  }

  return 1.0
}

// ─────────────────────────────────────────────────────────────
// EXPORT HELPER : Créer un engine depuis les données Prisma
// ─────────────────────────────────────────────────────────────

export function createEngineFromPrisma(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listing: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bookings: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  events: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competitors: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rules: any[]
): PricingEngine {
  const listingConfig: ListingConfig = {
    basePrice: listing.basePrice,
    minPrice: listing.minPrice,
    maxPrice: listing.maxPrice,
  }

  const bookingSlots: BookingSlot[] = bookings.map(b => ({
    checkIn: new Date(b.checkIn),
    checkOut: new Date(b.checkOut),
    pricePerNight: b.pricePerNight,
    source: b.revenueSource,
  }))

  const eventConfigs: EventConfig[] = events.map(e => ({
    name: e.name,
    startDate: new Date(e.startDate),
    endDate: new Date(e.endDate),
    impact: e.impact as EventConfig['impact'],
  }))

  const competitorPricePoints: CompetitorPricePoint[] = competitors.flatMap(c =>
    (c.prices ?? []).map((p: { date: string; price: number }) => ({
      date: new Date(p.date),
      price: p.price,
      source: (c.source ?? 'airbnb') as 'airbnb' | 'hotel',
    }))
  )

  const ruleConfigs: PricingRuleConfig[] = rules.map(r => ({
    id: r.id,
    type: r.type,
    enabled: r.active ?? r.enabled ?? true,
    modifier: r.modifier,
    conditions: {
      ...(r.condition ?? r.conditions ?? {}),
      // Map Prisma daysOfWeek array to conditions.days
      ...(r.daysOfWeek?.length ? { days: r.daysOfWeek } : {}),
    },
  }))

  return new PricingEngine(
    listingConfig,
    bookingSlots,
    eventConfigs,
    competitorPricePoints,
    ruleConfigs
  )
}
