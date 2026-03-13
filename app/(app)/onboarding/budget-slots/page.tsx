"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { BudgetSlotForm } from "@/components/onboarding/BudgetSlotForm";
import { BudgetSlotCard } from "@/components/onboarding/BudgetSlotCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BudgetSlot, CreateBudgetSlotInput } from "@/types/budget";

export default function OnboardingBudgetSlotsPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<BudgetSlot[]>([]);
  const [showForm, setShowForm] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleAddSlot(data: CreateBudgetSlotInput) {
    setSaving(true);
    const res = await fetch("/api/budget-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      setSaving(false);
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to create budget slot");
    }

    const created = await res.json();
    setSlots((prev) => [...prev, created]);
    setShowForm(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/budget-slots/${id}`, { method: "DELETE" });
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  function handleFinish() {
    router.push("/chat");
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-10 space-y-8">
      <div className="space-y-4">
        <StepIndicator currentStep={2} totalSteps={2} />
        <div>
          <h1 className="text-2xl font-bold">Set your budget slots</h1>
          <p className="mt-1 text-gray-500">
            Create time-based budget windows for your meals. You can always edit
            these later.
          </p>
        </div>
      </div>

      {slots.length > 0 && (
        <div className="space-y-3">
          {slots.map((slot) => (
            <BudgetSlotCard
              key={slot.id}
              slot={slot}
              onDelete={() => handleDelete(slot.id)}
            />
          ))}
        </div>
      )}

      {showForm ? (
        <BudgetSlotForm
          onSubmit={handleAddSlot}
          onCancel={slots.length > 0 ? () => setShowForm(false) : undefined}
          submitLabel="Add slot"
          loading={saving}
        />
      ) : (
        <div className="space-y-3">
          <Button
            variant="secondary"
            onClick={() => setShowForm(true)}
            className="w-full"
          >
            + Add another slot
          </Button>
        </div>
      )}

      {slots.length === 0 && !showForm && (
        <EmptyState
          title="No budget slots yet"
          description="Add at least one budget slot to get personalised recommendations."
          action={
            <Button onClick={() => setShowForm(true)}>Add a slot</Button>
          }
        />
      )}

      <div className="pt-4 border-t border-gray-200">
        <Button onClick={handleFinish} className="w-full">
          {slots.length > 0 ? "Finish setup" : "Skip for now"}
        </Button>
      </div>
    </div>
  );
}
