"use client";

import { useEffect, useState } from "react";
import { PreferencesForm } from "@/components/onboarding/PreferencesForm";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/Toast";
import type { Cuisine, DietaryRestriction, DistanceUnit } from "@/types/profile";

interface PreferencesData {
  cuisines: Cuisine[];
  dietary_restrictions: DietaryRestriction[];
  travel_radius_km: number;
  distance_unit: DistanceUnit;
}

export default function SettingsPreferencesPage() {
  const [prefs, setPrefs] = useState<PreferencesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences) {
          setPrefs({
            cuisines: data.preferences.cuisines ?? [],
            dietary_restrictions: data.preferences.dietary_restrictions ?? [],
            travel_radius_km: data.preferences.travel_radius_km ?? 5,
            distance_unit: data.preferences.distance_unit ?? "km",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(data: {
    cuisines: Cuisine[];
    dietary_restrictions: DietaryRestriction[];
    travel_radius_km: number;
    distance_unit: DistanceUnit;
  }) {
    setSaving(true);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to save preferences");
    }

    toast("Preferences updated", "success");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <p className="text-sm text-gray-500">
        Update your cuisine, dietary, and travel radius preferences.
      </p>

      <PreferencesForm
        initialCuisines={prefs?.cuisines}
        initialDietary={prefs?.dietary_restrictions}
        initialRadius={prefs?.travel_radius_km}
        initialDistanceUnit={prefs?.distance_unit}
        onSubmit={handleSubmit}
        submitLabel="Save changes"
        loading={saving}
      />
    </div>
  );
}
