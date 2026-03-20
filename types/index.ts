export interface PriceRecommendation {
  date: Date;
  basePrice: number;
  recommendedPrice: number;
  appliedRules: { name: string; modifier: number }[];
  reasoning: string;
  competitorAvg?: number;
  isAvailable: boolean;
}

export interface CompetitorData {
  source: "airbnb" | "hotel";
  externalUrl: string;
  externalId: string;
  name: string;
  price: number;
  rating: number;
  reviewCount: number;
  available: boolean;
  date: Date;
  propertyType?: string;
  imageUrl?: string;
  bedrooms?: number;
  address?: string;
}

export interface ListingAuditResult {
  scores: {
    title: number;
    description: number;
    photos: number;
    pricing: number;
  };
  totalScore: number;
  suggestions: ListingSuggestion[];
  titleSuggestions: string[];
  descriptionHook: string;
}

export interface ListingSuggestion {
  priority: "high" | "medium" | "low";
  category: "title" | "description" | "photos" | "pricing" | "amenities";
  current: string;
  suggested: string;
  impact: string;
}

export interface ReviewReplyResult {
  reply: string;
  sentiment: "positive" | "neutral" | "negative";
  keyPoints: string[];
  actionItems: string[];
}

export interface KPIData {
  revenue: number;
  revenuePrevMonth: number;
  occupancyRate: number;
  occupancyPrevMonth: number;
  avgPricePerNight: number;
  avgPricePrevMonth: number;
  avgRating: number;
  ratingPrevMonth: number;
}

export interface DashboardAlert {
  type: "warning" | "info" | "success" | "danger";
  title: string;
  message: string;
}

export interface CalendarDay {
  date: Date;
  price: number;
  recommendedPrice?: number;
  isAvailable: boolean;
  isBooked: boolean;
  appliedRules: { name: string; modifier: number }[];
}
