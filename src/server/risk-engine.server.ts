// Server-only ML risk scorer using Lovable AI Gateway as the fraud model.
// Given a feature vector, returns a calibrated 0-1 risk score, tier, top
// factors, and reasoning. Replaces the XGBoost-on-GPU service in the spec.

export interface RiskFeatures {
  location_distance_km: number;
  device_new: boolean;
  transaction_amount: number;
  time_hour: number; // 0-23 local
  transaction_frequency_24h: number;
  payee_trust_score: number; // 0-1
  user_avg_amount: number;
  user_max_amount: number;
  is_new_payee: boolean;
  city: string;
  home_city: string;
}

export interface RiskResult {
  risk_score: number;
  tier: "LOW" | "MEDIUM" | "HIGH";
  top_factors: { name: string; impact: number; note: string }[];
  reasoning: string;
  model: string;
}

const SYSTEM_PROMPT = `You are GEONEX-FraudNet, a calibrated fraud risk model for a digital banking platform.
You score a single transaction's fraud risk on a 0.000-1.000 continuous scale and decide a tier.

Tiers:
- LOW (< 0.30): trustworthy — allow without friction
- MEDIUM (0.30 - 0.70): suspicious — require OTP step-up
- HIGH (> 0.70): likely fraud — block, require manual review

You must consider:
- Geographic distance from trusted home city (>500 km is highly suspicious; >2000 km even more so)
- New device fingerprint (raises risk meaningfully)
- Transaction amount vs the user's historical average (3x+ avg is unusual; 10x+ is alarming)
- Time of day (2 AM - 5 AM transactions are more suspicious unless small)
- High velocity (many transactions in 24h)
- New payee with low trust score combined with high amount
- Combinations matter: a $50 transfer at 3 AM from a new city is not the same as $10,000.

Return STRICT JSON only via the score_risk tool. Do not return prose.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "score_risk",
    description: "Return a calibrated fraud risk score and reasoning for the transaction.",
    parameters: {
      type: "object",
      properties: {
        risk_score: {
          type: "number",
          description: "Calibrated risk score between 0.0 and 1.0",
        },
        tier: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
        top_factors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              impact: { type: "number", description: "How much this factor pushed score up (0-1)" },
              note: { type: "string", description: "Short human-readable explanation" },
            },
            required: ["name", "impact", "note"],
            additionalProperties: false,
          },
        },
        reasoning: { type: "string", description: "1-3 sentence rationale for analysts" },
      },
      required: ["risk_score", "tier", "top_factors", "reasoning"],
      additionalProperties: false,
    },
  },
};

function deriveTier(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score >= 0.7) return "HIGH";
  if (score >= 0.3) return "MEDIUM";
  return "LOW";
}

// Heuristic fallback if the AI gateway fails. Still feature-driven, not hardcoded responses.
function heuristicScore(f: RiskFeatures): RiskResult {
  let s = 0;
  const factors: RiskResult["top_factors"] = [];
  if (f.location_distance_km > 2000) {
    s += 0.45;
    factors.push({ name: "Geo anomaly", impact: 0.45, note: `${Math.round(f.location_distance_km)} km from trusted location` });
  } else if (f.location_distance_km > 500) {
    s += 0.22;
    factors.push({ name: "Geo distance", impact: 0.22, note: `${Math.round(f.location_distance_km)} km from trusted location` });
  }
  if (f.device_new) {
    s += 0.18;
    factors.push({ name: "New device", impact: 0.18, note: "Unrecognized device fingerprint" });
  }
  const ratio = f.user_avg_amount > 0 ? f.transaction_amount / f.user_avg_amount : 1;
  if (ratio > 10) {
    s += 0.30;
    factors.push({ name: "Amount anomaly", impact: 0.30, note: `${ratio.toFixed(1)}× your usual amount` });
  } else if (ratio > 3) {
    s += 0.12;
    factors.push({ name: "Above-average amount", impact: 0.12, note: `${ratio.toFixed(1)}× your average` });
  }
  if (f.time_hour >= 2 && f.time_hour <= 5 && f.transaction_amount > 100) {
    s += 0.10;
    factors.push({ name: "Off-hours", impact: 0.10, note: `Initiated at ${f.time_hour}:00` });
  }
  if (f.is_new_payee && f.transaction_amount > 500) {
    s += 0.15;
    factors.push({ name: "New payee", impact: 0.15, note: "First-time recipient with notable amount" });
  }
  if (f.transaction_frequency_24h > 8) {
    s += 0.10;
    factors.push({ name: "High velocity", impact: 0.10, note: `${f.transaction_frequency_24h} transactions in 24h` });
  }
  s = Math.min(1, Math.max(0, s));
  return {
    risk_score: Number(s.toFixed(3)),
    tier: deriveTier(s),
    top_factors: factors.sort((a, b) => b.impact - a.impact).slice(0, 4),
    reasoning: "Heuristic score (AI gateway unavailable). Combined feature contributions.",
    model: "heuristic-fallback",
  };
}

export async function scoreRisk(features: RiskFeatures): Promise<RiskResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return heuristicScore(features);
  }

  const userPayload = {
    features,
    instructions: "Score this banking transaction. Return only the score_risk tool call.",
  };

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "score_risk" } },
      }),
    });

    if (!resp.ok) {
      console.error("AI gateway error", resp.status, await resp.text().catch(() => ""));
      return heuristicScore(features);
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return heuristicScore(features);

    const parsed = JSON.parse(call.function.arguments);
    const score = Math.min(1, Math.max(0, Number(parsed.risk_score)));
    return {
      risk_score: Number(score.toFixed(3)),
      tier: (parsed.tier as RiskResult["tier"]) ?? deriveTier(score),
      top_factors: Array.isArray(parsed.top_factors) ? parsed.top_factors.slice(0, 5) : [],
      reasoning: String(parsed.reasoning ?? ""),
      model: "google/gemini-3-flash-preview",
    };
  } catch (err) {
    console.error("Risk scoring exception", err);
    return heuristicScore(features);
  }
}
