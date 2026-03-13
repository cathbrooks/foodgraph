import { z } from "zod";

export const IntentTypeSchema = z.enum([
  "recommend",
  "refine",
  "ask_detail",
  "general",
  "feedback",
  "followup",
  "unknown",
]);

export const IntentConstraintsSchema = z.object({
  cuisineFilter: z
    .string()
    .nullable()
    .optional()
    .describe("Specific cuisine the user wants, e.g. 'thai', 'italian'. Null if not specified."),
  priceCeiling: z
    .number()
    .nullable()
    .optional()
    .describe("Maximum price per person the user wants to spend. Null if not specified."),
  requestedWildcard: z
    .boolean()
    .optional()
    .describe("True if the user explicitly asks for a wildcard or surprise recommendation."),
  dietaryFilter: z
    .string()
    .nullable()
    .optional()
    .describe("Dietary requirement mentioned, e.g. 'vegetarian', 'vegan', 'gluten-free', 'halal'. Null if not specified."),
  targetRestaurant: z
    .string()
    .nullable()
    .optional()
    .describe("Name of the specific restaurant the user is asking about. Null if not applicable."),
});

export const IntentSchema = z.object({
  type: IntentTypeSchema,
  constraints: IntentConstraintsSchema,
});

export type ParsedIntent = z.infer<typeof IntentSchema>;
