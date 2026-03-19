import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/ai/anthropicClient";

export class MaxTurnsExceededError extends Error {
  constructor(maxTurns: number) {
    super(`Agent exceeded max turns (${maxTurns})`);
    this.name = "MaxTurnsExceededError";
  }
}

export interface AgentTool {
  definition: Anthropic.Tool;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface RunAgentOptions {
  messages: Anthropic.MessageParam[];
  systemPrompt: string;
  tools: AgentTool[];
  model: string;
  maxTurns?: number;
  maxTokens?: number;
}

/**
 * Runs the agentic tool-use loop synchronously.
 * Returns the full content of the final assistant message.
 */
export async function runAgent(
  options: RunAgentOptions
): Promise<Anthropic.ContentBlock[]> {
  const {
    systemPrompt,
    tools,
    model,
    maxTurns = 5,
    maxTokens = 4096,
  } = options;

  const client = getAnthropicClient();
  const messages: Anthropic.MessageParam[] = [...options.messages];
  const toolDefs = tools.map((t) => t.definition);
  const toolMap = new Map(tools.map((t) => [t.definition.name, t.handler]));

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await client.messages.create({
      model,
      system: systemPrompt,
      messages,
      tools: toolDefs.length > 0 ? toolDefs : undefined,
      max_tokens: maxTokens,
    });

    // Append assistant response to history
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      return response.content;
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const handler = toolMap.get(block.name);
          if (!handler) {
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify({ error: `Unknown tool: ${block.name}` }),
              is_error: true,
            };
          }

          try {
            const result = await handler(block.input as Record<string, unknown>);
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify(result),
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[runner] Tool "${block.name}" failed:`, err);
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify({ error: message }),
              is_error: true,
            };
          }
        })
      );

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason — return what we have
    console.warn(`[runner] Unexpected stop_reason: ${response.stop_reason}`);
    return response.content;
  }

  throw new MaxTurnsExceededError(maxTurns);
}

/**
 * Streaming variant of runAgent.
 * Yields text delta strings as they arrive from Claude.
 * On completion, yields a special final event with tool call metadata.
 *
 * Usage:
 *   for await (const event of streamAgent(options)) {
 *     if (event.type === 'text_delta') process(event.text);
 *     if (event.type === 'done') handle(event.finalContent);
 *   }
 */
export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "done"; finalContent: Anthropic.ContentBlock[] };

export async function* streamAgent(
  options: RunAgentOptions
): AsyncGenerator<StreamEvent> {
  const {
    systemPrompt,
    tools,
    model,
    maxTurns = 5,
    maxTokens = 4096,
  } = options;

  const client = getAnthropicClient();
  const messages: Anthropic.MessageParam[] = [...options.messages];
  const toolDefs = tools.map((t) => t.definition);
  const toolMap = new Map(tools.map((t) => [t.definition.name, t.handler]));

  for (let turn = 0; turn < maxTurns; turn++) {
    const stream = client.messages.stream({
      model,
      system: systemPrompt,
      messages,
      tools: toolDefs.length > 0 ? toolDefs : undefined,
      max_tokens: maxTokens,
    });

    // Collect the full response while streaming text deltas
    let finalMessage: Anthropic.Message | null = null;

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { type: "text_delta", text: event.delta.text };
      }
      if (event.type === "message_stop") {
        finalMessage = await stream.finalMessage();
      }
    }

    if (!finalMessage) {
      finalMessage = await stream.finalMessage();
    }

    messages.push({ role: "assistant", content: finalMessage.content });

    if (finalMessage.stop_reason === "end_turn") {
      yield { type: "done", finalContent: finalMessage.content };
      return;
    }

    if (finalMessage.stop_reason === "tool_use") {
      const toolUseBlocks = finalMessage.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const handler = toolMap.get(block.name);
          if (!handler) {
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify({ error: `Unknown tool: ${block.name}` }),
              is_error: true,
            };
          }

          try {
            const result = await handler(block.input as Record<string, unknown>);
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify(result),
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[runner] Tool "${block.name}" failed:`, err);
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify({ error: message }),
              is_error: true,
            };
          }
        })
      );

      messages.push({ role: "user", content: toolResults });
      // Tool turns don't stream text, so continue the loop
      continue;
    }

    // Unexpected stop reason
    console.warn(`[runner] Unexpected stop_reason: ${finalMessage.stop_reason}`);
    yield { type: "done", finalContent: finalMessage.content };
    return;
  }

  throw new MaxTurnsExceededError(maxTurns);
}
