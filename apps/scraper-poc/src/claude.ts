import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { ExtractedProductSchema, type ExtractedProduct } from './schema.ts';
import { pruneHtml } from './prune-html.ts';

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!cachedClient) cachedClient = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return cachedClient;
}

// Speed-first ladder. Haiku handles 90%+ of pages — the task is pattern
// matching against a fixed schema, no reasoning required. Sonnet steps in on
// parse/schema failures; Opus is the last resort. Each fallback is only
// triggered by RetryableExtractionError (bad JSON, schema miss), so hard
// failures (network, auth) still short-circuit.
const MODEL_LADDER = [
  'claude-haiku-4-5', // fastest, cheapest
  'claude-sonnet-4-6', // balanced
  'claude-opus-4-7', // strongest, slowest
] as const;

class RetryableExtractionError extends Error {}

const SHARED_RULES = `Respond with JSON only — no markdown fences, no preamble, no trailing prose.

Schema:
{
  "product_name": string | null,
  "brand":        string | null,
  "collection":   string | null,
  "finishes":     string[] | null,
  "sku":          string | null,
  "dimensions":   { [key: string]: string } | null,
  "image_url":    string | null
}

Rules:
- If you can not find the brand, use the website name as a fallback signal for the brand field — e.g. "west elm" if the page is on westelm.com.
- Return null for any field you cannot find with confidence.
- Do not invent or guess. Accuracy matters more than completeness.
- For finishes, return ALL available finish/colour options.
- For SKU, prefer the model number — not a UPC or internal ID.
- For image_url, return the absolute URL of the main product image.
- For dimensions, keys are dimension names (e.g. "width", "height", "depth",
  "diameter") and VALUES MUST BE STRINGS with units, e.g. "46.5 in", "15 cm".
  Do NOT nest objects like {"value": 46, "unitCode": "INH"} — flatten them
  into readable strings. Convert unit codes (INH→in, CMT→cm, MMT→mm) as needed.`;

const EXTRACTION_PROMPT = (html: string) =>
  `You are extracting product data from an interior design product page.

${SHARED_RULES}

Page HTML:
${html}`;

const JSONLD_PROMPT = (json: string) =>
  `You are normalizing Schema.org Product JSON-LD to a fixed schema.

${SHARED_RULES}

Product JSON-LD:
${json}`;

export interface ExtractResult {
  data: ExtractedProduct;
  inputTokens: number;
  outputTokens: number;
  claudeDurationMs: number;
  model: string;
  fallbackUsed: boolean;
}

async function callClaude(
  messages: MessageParam[],
  model: string,
): Promise<Omit<ExtractResult, 'fallbackUsed'>> {
  const started = Date.now();
  const response = await getClient().messages.create({
    model,
    max_tokens: 1024,
    messages,
  });
  const claudeDurationMs = Date.now() - started;

  const textBlock = response.content.find((c) => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new RetryableExtractionError('Claude returned no text block');
  }

  const raw = textBlock.text.trim();
  const jsonText = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new RetryableExtractionError(
      `Invalid JSON from Claude: ${(err as Error).message}\n--- raw response ---\n${raw}`,
    );
  }

  const result = ExtractedProductSchema.safeParse(parsed);
  if (!result.success) {
    throw new RetryableExtractionError(
      `Claude JSON failed schema validation: ${result.error.message}\n--- parsed ---\n${JSON.stringify(parsed, null, 2)}`,
    );
  }

  return {
    data: result.data,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    claudeDurationMs,
    model,
  };
}

async function extractWithFallback(
  messages: MessageParam[],
): Promise<ExtractResult> {
  const forced = process.env.CLAUDE_MODEL;
  if (forced) {
    const result = await callClaude(messages, forced);
    return { ...result, fallbackUsed: false };
  }

  for (let i = 0; i < MODEL_LADDER.length; i++) {
    const model = MODEL_LADDER[i];
    try {
      const result = await callClaude(messages, model);
      return { ...result, fallbackUsed: i > 0 };
    } catch (err) {
      if (!(err instanceof RetryableExtractionError)) throw err;
      const next = MODEL_LADDER[i + 1];
      if (!next) throw err; // exhausted the ladder
      console.error(
        `[extract] ${model} failed (${err.message.split('\n')[0]}), retrying with ${next}`,
      );
    }
  }
  // Unreachable — loop above either returns or throws.
  throw new Error('extract: model ladder exhausted without result');
}

// Path A: full browser-rendered HTML, optional screenshot for visual cues.
export async function extract(
  html: string,
  screenshotBase64: string | null,
): Promise<ExtractResult> {
  const cleanHtml = pruneHtml(html, 40_000);
  const content: Array<
    | { type: 'text'; text: string }
    | {
        type: 'image';
        source: { type: 'base64'; media_type: 'image/jpeg'; data: string };
      }
  > = [{ type: 'text', text: EXTRACTION_PROMPT(cleanHtml) }];
  if (screenshotBase64) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: screenshotBase64,
      },
    });
  }
  return extractWithFallback([{ role: 'user', content }]);
}

// Path B: Schema.org Product JSON-LD — no image, tiny prompt, much cheaper.
export async function extractFromJsonLd(
  jsonLd: unknown,
): Promise<ExtractResult> {
  const jsonStr = JSON.stringify(jsonLd).slice(0, 15_000);
  return extractWithFallback([
    {
      role: 'user',
      content: [{ type: 'text', text: JSONLD_PROMPT(jsonStr) }],
    },
  ]);
}
