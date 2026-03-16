import type { Restaurant } from "@/types/restaurant";
import type { BudgetSlot } from "@/types/budget";
import type { UserPreferences } from "@/types/profile";

export type SearchSource = "nearby" | "text";

export interface FilterOptions {
  budget: BudgetSlot | null;
  preferences: UserPreferences | null;
  maxDistanceKm?: number;
  requireOpenNow?: boolean;
  cuisineOverride?: string;
  dietaryOverride?: string;
  priceFloor?: number;
  searchSource?: SearchSource;
}

export function filterRestaurants(
  restaurants: Restaurant[],
  options: FilterOptions
): Restaurant[] {
  const fromTextSearch = options.searchSource === "text";
  let result = [...restaurants];
  console.log(`[filter] start: ${result.length} (source: ${options.searchSource ?? "unknown"})`);

  if (result.length > 0) {
    const sample = result.slice(0, 3).map((r) => ({ name: r.name, cuisines: r.cuisines }));
    console.log("[filter] sample cuisines:", JSON.stringify(sample));
  }

  if (!fromTextSearch && options.requireOpenNow !== false) {
    result = result.filter((r) => r.is_open_now !== false);
    console.log(`[filter] after open_now: ${result.length}`);
  }

  if (!fromTextSearch && options.cuisineOverride) {
    const target = options.cuisineOverride.toLowerCase();
    result = result.filter(
      (r) =>
        r.cuisines.some((c) => c.toLowerCase().includes(target)) ||
        r.name.toLowerCase().includes(target)
    );
    console.log(`[filter] after cuisine "${options.cuisineOverride}": ${result.length}`);
  }

  if (options.budget) {
    const { min_budget, max_budget } = options.budget;
    result = result.filter((r) => {
      if (r.avg_price_per_person == null) return true;
      return (
        r.avg_price_per_person >= min_budget * 0.8 &&
        r.avg_price_per_person <= max_budget * 1.2
      );
    });
    console.log(`[filter] after budget ($${options.budget.min_budget}–$${options.budget.max_budget}): ${result.length}`);
  }

  if (options.priceFloor != null) {
    const floor = options.priceFloor;
    const priceLevelMinima: Record<string, number> = { "$": 0, "$$": 15, "$$$": 30, "$$$$": 50 };
    result = result.filter((r) => {
      if (r.avg_price_per_person != null) return r.avg_price_per_person >= floor;
      if (r.price_level != null) return (priceLevelMinima[r.price_level] ?? 0) >= floor * 0.6;
      return true;
    });
    console.log(`[filter] after priceFloor ($${floor}): ${result.length}`);
  }

  if (options.maxDistanceKm != null) {
    result = result.filter((r) => {
      if (r.distance_km == null) return true;
      return r.distance_km <= options.maxDistanceKm!;
    });
    console.log(`[filter] after distance (${options.maxDistanceKm}km): ${result.length}`);
  }

  if (options.dietaryOverride) {
    const target = options.dietaryOverride.toLowerCase().replace(/[_\s]/g, "-");
    result = result.filter((r) => {
      if (r.dietary_tags.some(
        (t) => t.toLowerCase().replace(/[_\s]/g, "-").includes(target)
      )) return true;
      if (r.name.toLowerCase().includes(target)) return true;
      if (r.cuisines.some((c) => c.toLowerCase().includes(target))) return true;
      return false;
    });
    console.log(`[filter] after dietaryOverride "${options.dietaryOverride}": ${result.length}`);
  }

  const restrictions = options.preferences?.dietary_restrictions?.filter(
    (d) => d !== "none"
  );
  if (restrictions && restrictions.length > 0) {
    result = result.filter((r) => {
      if (r.dietary_tags.length === 0) return true;
      return restrictions.some((d) => r.dietary_tags.includes(d));
    });
    console.log(`[filter] after dietary_restrictions: ${result.length}`);
  }

  console.log(`[filter] final: ${result.length}`);
  return result;
}
