"use client";

import { useEffect, useState, useCallback } from "react";
import { BudgetSlotForm } from "@/components/onboarding/BudgetSlotForm";
import { BudgetSlotCard } from "@/components/onboarding/BudgetSlotCard";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toast";
import type { BudgetSlot, CreateBudgetSlotInput } from "@/types/budget";

export default function SettingsBudgetSlotsPage() {
  const [slots, setSlots] = useState<BudgetSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchSlots = useCallback(async () => {
    const res = await fetch("/api/budget-slots");
    if (res.ok) {
      setSlots(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  async function handleCreate(data: CreateBudgetSlotInput) {
    setSaving(true);
    const res = await fetch("/api/budget-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to create slot");
    }

    const created = await res.json();
    setSlots((prev) => [...prev, created]);
    setShowForm(false);
    toast("Budget slot created", "success");
  }

  async function handleUpdate(data: CreateBudgetSlotInput) {
    if (!editingId) return;
    setSaving(true);
    const res = await fetch(`/api/budget-slots/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to update slot");
    }

    const updated = await res.json();
    setSlots((prev) => prev.map((s) => (s.id === editingId ? updated : s)));
    setEditingId(null);
    toast("Budget slot updated", "success");
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/budget-slots/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setSlots((prev) => prev.filter((s) => s.id !== id));
      toast("Budget slot deleted");
    }
  }

  function startEdit(slot: BudgetSlot) {
    setEditingId(slot.id);
    setShowForm(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const editingSlot = editingId
    ? slots.find((s) => s.id === editingId)
    : null;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Manage your time-based budget slots.
        </p>
        {!showForm && !editingId && (
          <Button onClick={() => setShowForm(true)} className="shrink-0">
            + Add slot
          </Button>
        )}
      </div>

      {showForm && (
        <BudgetSlotForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          submitLabel="Create"
          loading={saving}
        />
      )}

      {editingSlot && (
        <BudgetSlotForm
          initial={editingSlot}
          onSubmit={handleUpdate}
          onCancel={() => setEditingId(null)}
          submitLabel="Update"
          loading={saving}
        />
      )}

      {slots.length > 0 ? (
        <div className="space-y-3">
          {slots.map((slot) => (
            <BudgetSlotCard
              key={slot.id}
              slot={slot}
              onEdit={() => startEdit(slot)}
              onDelete={() => handleDelete(slot.id)}
            />
          ))}
        </div>
      ) : (
        !showForm && (
          <EmptyState
            title="No budget slots"
            description="Create budget slots to get personalised recommendations based on your spending habits."
            action={
              <Button onClick={() => setShowForm(true)}>
                Create your first slot
              </Button>
            }
          />
        )
      )}
    </div>
  );
}
