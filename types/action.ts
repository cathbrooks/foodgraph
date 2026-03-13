import { z } from "zod";

export const UserActionTypeSchema = z.enum([
  "click",
  "select",
  "wildcard_request",
  "wildcard_select",
  "dismiss",
]);

export type UserActionType = z.infer<typeof UserActionTypeSchema>;

export const UserActionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  recommendation_event_id: z.string().uuid(),
  restaurant_place_id: z.string().nullable(),
  action_type: UserActionTypeSchema,
  metadata: z.record(z.unknown()).nullable(),
  created_at: z.string().datetime(),
});

export type UserAction = z.infer<typeof UserActionSchema>;

export const CreateUserActionSchema = z.object({
  recommendation_event_id: z.string().uuid(),
  restaurant_place_id: z.string().nullable().optional(),
  action_type: UserActionTypeSchema,
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type CreateUserActionInput = z.infer<typeof CreateUserActionSchema>;
