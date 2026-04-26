import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — GEONEX" },
      { name: "description", content: "Sign in to your GEONEX banking account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/app" });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/app" });
  };

  const fillDemo = (which: "customer" | "admin") => {
    if (which === "customer") {
      setEmail("priya.sharma@geonex.demo");
      setPassword("Demo1234!");
    } else {
      setEmail("admin@geonex.demo");
      setPassword("Admin1234!");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-display font-semibold tracking-tight">GEONEX</span>
        </Link>

        <Card className="p-8 shadow-elevated">
          <h1 className="text-2xl font-semibold mb-1">Sign in</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Access your accounts securely. We'll verify your location and device.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-muted-foreground mb-3 font-medium">Demo accounts</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => fillDemo("customer")}>
                Customer
              </Button>
              <Button variant="outline" size="sm" type="button" onClick={() => fillDemo("admin")}>
                Admin
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              No account?{" "}
              <Link to="/signup" className="text-primary hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
