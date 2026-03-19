import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/ai/anthropicClient";
import { jsonError } from "@/lib/utils/validation";

const REFRESH_EVERY = 3;

const DEFAULT_LABELS = [
  "I'm craving Thai food",
  "Somewhere vegetarian-friendly",
  "Surprise me \u2014 anything goes!",
  "What's good for a group dinner?",
  "I'm feeling fancy",
];

const GREETING_POOL = [
  "Hungry?",
  "Hungry?",
  "Hungry?",
  "What sounds good?",
  "Craving something?",
  "Ready to eat?",
  "Let\u2019s find food!",
  "Feeling peckish?",
];

function pickGreeting(visitCount: number): string {
  return GREETING_POOL[visitCount % GREETING_POOL.length];
}

const CHIPS_SYSTEM_PROMPT = `You generate short, friendly button labels for a restaurant recommendation app. Produce exactly 5 labels, one per line, no numbering or bullets. Each must be under 40 characters.

Constraints for each line:
1. A cuisine craving — format "I'm craving [cuisine]" where cuisine is one of: Thai, Chinese, Italian, Mexican, Japanese, Indian, Korean, Vietnamese, Mediterranean, Greek, Peruvian, Ethiopian, or French.
2. A dietary preference — mention one of: vegetarian, vegan, gluten-free, dairy-free, halal, or pescatarian. Keep the same casual tone as "Somewhere vegetarian-friendly".
3. A fun "surprise me" phrase — playful but short, conveying openness to anything. Use an em dash or exclamation for flair.
4. A dining occasion — mention one of: group dinner, date night, solo lunch, family brunch, late-night bite, or quick weekday lunch. Same tone as "What's good for a group dinner?"
5. An upscale/splurge vibe — convey wanting something fancy or special. Keep it short and fun like "I'm feeling fancy".

Be cute and warm but not over-the-top. Vary from these defaults but stay close in tone:
- I'm craving Thai food
- Somewhere vegetarian-friendly
- Surprise me — anything goes!
- What's good for a group dinner?
- I'm feeling fancy`;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);

  const { data: row } = await supabase
    .from("welcome_chip_cache")
    .select("labels, visit_count, greeting")
    .eq("user_id", user.id)
    .single();

  if (!row) {
    const greeting = pickGreeting(1);
    await supabase.from("welcome_chip_cache").insert({
      user_id: user.id,
      labels: DEFAULT_LABELS,
      visit_count: 1,
      greeting,
    });
    return NextResponse.json({ labels: DEFAULT_LABELS, greeting });
  }

  const nextCount = row.visit_count + 1;
  const greeting = pickGreeting(nextCount);
  const needsRefresh = nextCount % REFRESH_EVERY === 0;

  if (!needsRefresh) {
    await supabase
      .from("welcome_chip_cache")
      .update({ visit_count: nextCount, greeting, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    const labels = row.labels?.length === DEFAULT_LABELS.length ? row.labels : DEFAULT_LABELS;
    return NextResponse.json({ labels, greeting });
  }

  let newLabels = DEFAULT_LABELS;
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: CHIPS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: "Generate 5 new button labels." }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    const parsed = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.length <= 50);

    if (parsed.length === DEFAULT_LABELS.length) {
      newLabels = parsed;
    }
  } catch {
    // LLM failure — keep previous labels
    if (row.labels?.length === DEFAULT_LABELS.length) {
      newLabels = row.labels;
    }
  }

  await supabase
    .from("welcome_chip_cache")
    .update({
      labels: newLabels,
      visit_count: nextCount,
      greeting,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  return NextResponse.json({ labels: newLabels, greeting });
}
