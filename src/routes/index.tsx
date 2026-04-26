import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Brain, MapPin, Lock, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GEONEX — AI-Powered Digital Banking" },
      {
        name: "description",
        content:
          "GEONEX is a next-generation banking platform with adaptive AI fraud detection, geo-lock security, and real-time transaction intelligence.",
      },
      { property: "og:title", content: "GEONEX — AI-Powered Digital Banking" },
      {
        property: "og:description",
        content:
          "Adaptive ML fraud detection, geo-lock security, and a banking experience built for the way you actually move money.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Nav */}
      <header className="border-b border-border/40 backdrop-blur-md bg-background/60 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-display font-semibold tracking-tight">GEONEX</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Open account</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main>
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-24">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/60 border border-border/60 text-xs font-medium mb-6">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Adaptive AI fraud engine — live</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-display font-semibold tracking-tight leading-[1.05]">
              Banking that thinks <span className="text-gradient-primary">before it moves money.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
              GEONEX scores every transaction in real time. Low risk flows through instantly.
              Suspicious moves trigger smart step-up. Fraud is blocked before it lands.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to="/signup">
                <Button size="lg" className="shadow-glow">
                  Open an account
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">
                  Try the demo
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Feature grid */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: "Adaptive AI risk model",
                body: "A calibrated 0–1 fraud score on every transaction. Not rules — context. A $5 coffee at 3 AM is not a $5,000 wire to a new payee abroad.",
              },
              {
                icon: MapPin,
                title: "Geo-lock by default",
                body: "We learn your trusted cities. Transactions from elsewhere step up to OTP, or get blocked outright if the distance and amount don't make sense.",
              },
              {
                icon: Lock,
                title: "Tiered step-up security",
                body: "Low risk: pass. Medium: email OTP. High: blocked with manual review. No raw scores, no false alarms — just the right friction at the right moment.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="p-6 rounded-2xl bg-card border border-border shadow-soft hover:shadow-elevated transition-shadow"
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA strip */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="rounded-3xl p-10 md:p-14 bg-gradient-card text-primary-foreground shadow-elevated relative overflow-hidden">
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-display font-semibold tracking-tight max-w-2xl">
                Move money like it's 2030.
              </h2>
              <p className="mt-4 max-w-xl text-primary-foreground/80">
                Multi-step transfer flow, instant confirmations, and a security engine that actually
                pays attention. Open an account in under a minute.
              </p>
              <div className="mt-8">
                <Link to="/signup">
                  <Button size="lg" variant="secondary" className="shadow-soft">
                    Get started
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>GEONEX — Demo banking platform</span>
          </div>
          <div className="text-xs">
            For demonstration only. No real funds are moved.
          </div>
        </div>
      </footer>
    </div>
  );
}
