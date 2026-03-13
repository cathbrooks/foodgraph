"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Cuisine, DietaryRestriction } from "@/types/profile";

const CUISINE_OPTIONS: { value: Cuisine; label: string }[] = [
  { value: "american", label: "American" },
  { value: "chinese", label: "Chinese" },
  { value: "indian", label: "Indian" },
  { value: "italian", label: "Italian" },
  { value: "japanese", label: "Japanese" },
  { value: "korean", label: "Korean" },
  { value: "mexican", label: "Mexican" },
  { value: "thai", label: "Thai" },
  { value: "vietnamese", label: "Vietnamese" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "french", label: "French" },
  { value: "caribbean", label: "Caribbean" },
  { value: "middle_eastern", label: "Middle Eastern" },
  { value: "african", label: "African" },
  { value: "other", label: "Other" },
];

const DIETARY_OPTIONS: { value: DietaryRestriction; label: string }[] = [
  { value: "none", label: "No restrictions" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten_free", label: "Gluten-free" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Kosher" },
  { value: "dairy_free", label: "Dairy-free" },
  { value: "nut_free", label: "Nut-free" },
];

interface PreferencesFormProps {
  initialCuisines?: Cuisine[];
  initialDietary?: DietaryRestriction[];
  initialRadius?: number;
  onSubmit: (data: {
    cuisines: Cuisine[];
    dietary_restrictions: DietaryRestriction[];
    travel_radius_km: number;
  }) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
}

export function PreferencesForm({
  initialCuisines = [],
  initialDietary = [],
  initialRadius = 5,
  onSubmit,
  submitLabel = "Save preferences",
  loading = false,
}: PreferencesFormProps) {
  const [cuisines, setCuisines] = useState<Cuisine[]>(initialCuisines);
  const [dietary, setDietary] = useState<DietaryRestriction[]>(initialDietary);
  const [radius, setRadius] = useState(initialRadius);
  const [error, setError] = useState<string | null>(null);

  function toggleCuisine(c: Cuisine) {
    setCuisines((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  function toggleDietary(d: DietaryRestriction) {
    if (d === "none") {
      setDietary(["none"]);
      return;
    }
    setDietary((prev) => {
      const without = prev.filter((x) => x !== "none");
      return without.includes(d)
        ? without.filter((x) => x !== d)
        : [...without, d];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (cuisines.length === 0) {
      setError("Select at least one cuisine.");
      return;
    }

    try {
      await onSubmit({
        cuisines,
        dietary_restrictions: dietary.length === 0 ? ["none"] : dietary,
        travel_radius_km: radius,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Favourite cuisines</h2>
        <p className="text-sm text-gray-500">
          Select all the cuisines you enjoy.
        </p>
        <div className="flex flex-wrap gap-2">
          {CUISINE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleCuisine(opt.value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                cuisines.includes(opt.value)
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Dietary restrictions</h2>
        <p className="text-sm text-gray-500">
          We&apos;ll filter recommendations accordingly.
        </p>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleDietary(opt.value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                dietary.includes(opt.value)
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Travel radius</h2>
        <p className="text-sm text-gray-500">
          How far are you willing to travel for food?
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0.5}
            max={50}
            step={0.5}
            value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value))}
            className="flex-1 accent-black"
          />
          <Input
            type="number"
            min={0.5}
            max={50}
            step={0.5}
            value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value) || 5)}
            className="w-20 text-center"
          />
          <span className="text-sm text-gray-500">km</span>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saving\u2026" : submitLabel}
      </Button>
    </form>
  );
}
