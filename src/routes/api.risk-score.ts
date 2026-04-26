// Server route that proxies to the LOVABLE_API_KEY-backed risk engine.
// Public endpoint by design — features only contain the request the client
// already has access to; no PII leaves the user's session.
import { createFileRoute } from "@tanstack/react-router";
import { scoreRisk, type RiskFeatures } from "@/server/risk-engine.server";

export const Route = createFileRoute("/api/risk-score")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as { features: RiskFeatures };
          if (!body?.features) return new Response("missing features", { status: 400 });
          const result = await scoreRisk(body.features);
          return Response.json(result);
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "scoring failed", { status: 500 });
        }
      },
    },
  },
});
