import type Anthropic from "@anthropic-ai/sdk";
import type { AgentTool } from "@/lib/agent/runner";
import { createClient } from "@/lib/supabase/server";

const definition: Anthropic.Tool = {
  name: "complete_onboarding",
  description:
    "Mark the user's onboarding as complete. Call this only after save_preferences and at least one create_budget_slot have succeeded.",
  input_schema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export function buildCompleteOnboardingTool(userId: string): AgentTool {
  return {
    definition,
    handler: async () => {
      try {
        const supabase = await createClient();
        const { error } = await supabase
          .from("profiles")
          .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
          .eq("user_id", userId);

        if (error) {
          console.error("[completeOnboarding] Update failed:", error.message);
          return { success: false, error: error.message };
        }

        return { success: true };
      } catch (err) {
        console.error("[completeOnboarding] Unexpected error:", err);
        return { success: false, error: "Unexpected error" };
      }
    },
  };
}
