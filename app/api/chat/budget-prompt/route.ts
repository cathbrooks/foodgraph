import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOpenAIClient } from "@/lib/ai/client";
import { withTimeout } from "@/lib/ai/timeout";
import { jsonError } from "@/lib/utils/validation";
import { z } from "zod";

const RequestSchema = z.object({
  user_message: z.string().min(1).max(500),
});

const BUDGET_PROMPT_SYSTEM = `You are a friendly restaurant recommendation assistant. The user just told you what they're looking for. Write a SHORT (1-2 sentences max) response that:
1. Acknowledges what they want in a warm, conversational way
2. Asks whether they want to stick to their usual budget or keep it open

Do NOT list options or use bullet points. Keep it casual and brief. Do not mention specific dollar amounts.

Example: "Ooh, Thai sounds great! Do you want me to keep it within your usual budget, or are you open to anything?"`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid request");

  try {
    const llm = getOpenAIClient();
    const response = await withTimeout(
      llm.invoke([
        { role: "system", content: BUDGET_PROMPT_SYSTEM },
        { role: "user", content: parsed.data.user_message },
      ]),
      3000
    );

    const text =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    return NextResponse.json({ message: text });
  } catch {
    return NextResponse.json({
      message: "Sounds good! Do you want me to stick to your usual budget, or are you open to anything?",
    });
  }
}
