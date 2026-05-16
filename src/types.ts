/**
 * WanderWise Type Definitions
 */

export type Category = 'Restaurants' | 'Attractions' | 'Events' | 'Activities' | 'Stays' | 'Transport' | 'Shopping';

export interface Place {
  id: string;
  name: string;
  category: Category;
  city: string;
  country: string;
  description: string;
  estimatedCostUSD: number;
  durationHours: number;
  rating: number;
  tags: string[];
  openingHours: string;
}

export interface ItineraryItem extends Place {
  slotId: string; // morning, afternoon, evening, night
  actualCost: number;
}

export interface DayItinerary {
  morning: ItineraryItem[];
  afternoon: ItineraryItem[];
  evening: ItineraryItem[];
  night: ItineraryItem[];
}

export interface UserProfile {
  name: string;
  dailyBudget: number;
  homeCity: string;
  homeCurrency: string; // e.g., 'USD', 'INR'
  budgetSplit: Record<string, number>; // percentages for Stay, Food, Transport, Life, Shopping
}

export type SlotKey = keyof DayItinerary;
