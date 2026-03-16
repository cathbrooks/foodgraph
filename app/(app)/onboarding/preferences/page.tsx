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

    // #region agent log
    console.log('[DEBUG-0dbf01] about to PUT /api/profile, payload:', JSON.stringify(data));
    fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0dbf01'},body:JSON.stringify({sessionId:'0dbf01',location:'onboarding/preferences/page.tsx:beforePUT',message:'about to PUT /api/profile',data:{payload:data},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    // #region agent log
    const resBody = await res.json().catch(() => null);
    console.log('[DEBUG-0dbf01] PUT /api/profile response:', JSON.stringify({status:res.status,ok:res.ok,body:resBody}));
    fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0dbf01'},body:JSON.stringify({sessionId:'0dbf01',location:'onboarding/preferences/page.tsx:afterPUT',message:'PUT /api/profile response',data:{status:res.status,ok:res.ok,body:resBody},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (!res.ok) {
      throw new Error(resBody?.error ?? "Failed to save preferences");
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
