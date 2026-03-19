import type Anthropic from "@anthropic-ai/sdk";
import type { AgentTool } from "@/lib/agent/runner";
import { createClient } from "@/lib/supabase/server";

const VALID_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const definition: Anthropic.Tool = {
  name: "create_budget_slot",
  description:
    "Create a budget slot — a named spending range per person that applies to specific days and times. Call this once per budget window the user describes.",
  input_schema: {
    type: "object" as const,
    properties: {
      label: {
        type: "string",
        description: "Short descriptive label, e.g. 'Weekday lunch' or 'Weekend dinner'",
      },
      days: {
        type: "array",
        description: `Days this slot applies to (case-insensitive). Valid values: ${VALID_DAYS.join(", ")}`,
        items: { type: "string" },
      },
      start_time: {
        type: "string",
        description: "Start time in HH:MM 24-hour format, e.g. '11:30'",
      },
      end_time: {
        type: "string",
        description: "End time in HH:MM 24-hour format, e.g. '14:00'",
      },
      min_budget: {
        type: "number",
        description: "Minimum spend per person in USD",
      },
      max_budget: {
        type: "number",
        description: "Maximum spend per person in USD",
      },
    },
    required: ["label", "days", "start_time", "end_time", "min_budget", "max_budget"],
  },
};

export function buildCreateBudgetSlotTool(userId: string): AgentTool {
  return {
    definition,
    handler: async (input) => {
      const label = input.label as string;
      const days = (input.days as string[])
        .map((d) => d.toLowerCase())
        .filter((d) => VALID_DAYS.includes(d));
      const start_time = input.start_time as string;
      const end_time = input.end_time as string;
      const min_budget = input.min_budget as number;
      const max_budget = input.max_budget as number;

      if (days.length === 0) {
        return { success: false, error: "No valid days provided" };
      }
      if (min_budget < 0 || max_budget < min_budget) {
        return { success: false, error: "Invalid budget range" };
      }

      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("budget_slots")
          .insert({ user_id: userId, label, days, start_time, end_time, min_budget, max_budget })
          .select("id")
          .single();

        if (error) {
          console.error("[createBudgetSlot] Insert failed:", error.message);
          return { success: false, error: error.message };
        }

        return { success: true, slot_id: data.id };
      } catch (err) {
        console.error("[createBudgetSlot] Unexpected error:", err);
        return { success: false, error: "Unexpected error" };
      }
    },
  };
}
