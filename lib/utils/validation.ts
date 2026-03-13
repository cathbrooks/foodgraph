import { z } from "zod";

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

export function parseSearchParams(
  searchParams: URLSearchParams,
  schema: z.ZodTypeAny
) {
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  return schema.safeParse(raw);
}

export function jsonError(message: string, status: number = 400) {
  return Response.json({ error: message }, { status });
}
