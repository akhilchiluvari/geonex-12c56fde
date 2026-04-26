import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Construction } from "lucide-react";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Dashboard — GEONEX" }] }),
  component: AppHome,
});

function AppHome() {
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-4 py-12">
      <Card className="max-w-lg p-10 text-center shadow-elevated">
        <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-display font-semibold mb-2">You're signed in to GEONEX</h1>
        <p className="text-sm text-muted-foreground mb-6 flex items-center justify-center gap-2">
          <Construction className="h-4 w-4" />
          The full banking dashboard is being built next.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Coming online: dashboard, multi-step transfer with AI risk scoring, cards, bills,
          statements, geo-lock, OTP step-up, and the admin panel for flagged transactions.
        </p>
        <Link to="/"><Button variant="outline">Back to home</Button></Link>
      </Card>
    </div>
  );
}
