"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { PreferencesForm } from "@/components/onboarding/PreferencesForm";
import type { Cuisine, DietaryRestriction } from "@/types/profile";

export default function OnboardingPreferencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(data: {
    cuisines: Cuisine[];
    dietary_restrictions: DietaryRestriction[];
    travel_radius_km: number;
  }) {
    setLoading(true);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to save preferences");
    }

    router.push("/onboarding/budget-slots");
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-10 space-y-8">
      <div className="space-y-4">
        <StepIndicator currentStep={1} totalSteps={2} />
        <div>
          <h1 className="text-2xl font-bold">Set your preferences</h1>
          <p className="mt-1 text-gray-500">
            Tell us what you like so we can personalise your recommendations.
          </p>
        </div>
      </div>

      <PreferencesForm
        onSubmit={handleSubmit}
        submitLabel="Continue"
        loading={loading}
      />
    </div>
  );
}
