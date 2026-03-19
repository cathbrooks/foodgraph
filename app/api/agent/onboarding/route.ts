import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamAgent } from "@/lib/agent/runner";
import { buildOnboardingAgent } from "@/lib/agent/onboardingAgent";
import type Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, history = [] } = body as {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const { systemPrompt, tools, model, maxTurns } = buildOnboardingAgent(user.id);

  let onboardingCompleted = false;

  const wrappedTools = tools.map((t) => {
    if (t.definition.name === "complete_onboarding") {
      return {
        ...t,
        handler: async (input: Record<string, unknown>) => {
          const result = await t.handler(input);
          onboardingCompleted = true;
          return result;
        },
      };
    }
    return t;
  });

  // __init__ is sent by the client to trigger the opening greeting.
  // Replace it with a neutral prompt so Claude doesn't try to infer preferences
  // from a meaningless token and call tools before the user has said anything.
  const normalizedMessage = message === "__init__" ? "Hi!" : message;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user" as const, content: normalizedMessage },
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        for await (const event of streamAgent({
          messages,
          systemPrompt,
          tools: wrappedTools,
          model,
          maxTurns,
        })) {
          if (event.type === "text_delta") {
            send({ type: "text", delta: event.text });
          }
        }

        // Fallback: if the tool wasn't flagged in this request, check the DB
        // (handles edge cases where Claude skips the tool call)
        if (!onboardingCompleted) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("user_id", user.id)
            .single();
          if (profile?.onboarding_completed) {
            onboardingCompleted = true;
          }
        }

        if (onboardingCompleted) {
          send({ type: "complete" });
        }

        send({ type: "done" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[onboarding route] Stream error:", err);
        send({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
