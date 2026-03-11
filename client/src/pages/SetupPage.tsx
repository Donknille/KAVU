import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { HardHat } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SetupPage() {
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !firstName || !lastName) return;
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/setup", {
        companyName,
        firstName,
        lastName,
        phone,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Einrichtung fehlgeschlagen. Bitte versuche es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
            <HardHat className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Willkommen!</h1>
            <p className="text-sm text-muted-foreground">Richte deinen Betrieb ein</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="companyName">Firmenname</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="z.B. Müller Solartechnik"
              required
              data-testid="input-company-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">Vorname</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                data-testid="input-first-name"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Nachname</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                data-testid="input-last-name"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="phone">Telefon (optional)</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+49..."
              data-testid="input-phone"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-12 text-base"
            disabled={isLoading || !companyName || !firstName || !lastName}
            data-testid="button-submit-setup"
          >
            {isLoading ? "Wird eingerichtet..." : "Betrieb einrichten"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
