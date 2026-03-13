import { z } from "zod";

export const DayOfWeekSchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;

export const TimeStringSchema = z.string().regex(
  /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
  "Time must be in HH:MM 24-hour format"
);

export const BudgetSlotSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  label: z.string().min(1).max(100),
  days: z.array(DayOfWeekSchema).min(1),
  start_time: TimeStringSchema,
  end_time: TimeStringSchema,
  min_budget: z.number().min(0),
  max_budget: z.number().min(0),
  hidden: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type BudgetSlot = z.infer<typeof BudgetSlotSchema>;

export const CreateBudgetSlotSchema = z.object({
  label: z.string().min(1).max(100),
  days: z.array(DayOfWeekSchema).min(1),
  start_time: TimeStringSchema,
  end_time: TimeStringSchema,
  min_budget: z.number().min(0),
  max_budget: z.number().min(0),
}).refine((data) => data.max_budget >= data.min_budget, {
  message: "max_budget must be >= min_budget",
  path: ["max_budget"],
});

export type CreateBudgetSlotInput = z.infer<typeof CreateBudgetSlotSchema>;

export const UpdateBudgetSlotSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  days: z.array(DayOfWeekSchema).min(1).optional(),
  start_time: TimeStringSchema.optional(),
  end_time: TimeStringSchema.optional(),
  min_budget: z.number().min(0).optional(),
  max_budget: z.number().min(0).optional(),
  hidden: z.boolean().optional(),
});

export type UpdateBudgetSlotInput = z.infer<typeof UpdateBudgetSlotSchema>;
