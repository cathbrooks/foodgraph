import type Anthropic from "@anthropic-ai/sdk";
import type { AgentTool } from "@/lib/agent/runner";
import { createClient } from "@/lib/supabase/server";

const VALID_CUISINES = [
  "american", "chinese", "indian", "italian", "japanese", "korean",
  "mexican", "thai", "vietnamese", "mediterranean", "french",
  "caribbean", "middle_eastern", "african", "other",
];

const VALID_DIETARY = [
  "vegetarian", "vegan", "gluten_free", "halal", "kosher",
  "dairy_free", "nut_free", "none",
];

const definition: Anthropic.Tool = {
  name: "save_preferences",
  description: "Save the user's cuisine preferences and dietary restrictions.",
  input_schema: {
    type: "object" as const,
    properties: {
      cuisines: {
        type: "array",
        description: `Cuisines the user enjoys. Valid values: ${VALID_CUISINES.join(", ")}`,
        items: { type: "string" },
      },
      dietary_restrictions: {
        type: "array",
        description: `Dietary restrictions. Valid values: ${VALID_DIETARY.join(", ")}. Use ["none"] if no restrictions.`,
        items: { type: "string" },
      },
    },
    required: ["cuisines", "dietary_restrictions"],
  },
};

export function buildSavePreferencesTool(userId: string): AgentTool {
  return {
    definition,
    handler: async (input) => {
      const cuisines = (input.cuisines as string[]).filter((c) => VALID_CUISINES.includes(c));
      const dietary_restrictions = (input.dietary_restrictions as string[]).filter((d) =>
        VALID_DIETARY.includes(d)
      );

      try {
        const supabase = await createClient();
        const { error } = await supabase
          .from("user_preferences")
          .upsert(
            {
              user_id: userId,
              cuisines,
              dietary_restrictions,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

        if (error) {
          console.error("[savePreferences] Upsert failed:", error.message);
          return { success: false, error: error.message };
        }

        return { success: true };
      } catch (err) {
        console.error("[savePreferences] Unexpected error:", err);
        return { success: false, error: "Unexpected error" };
      }
    },
  };
}
