import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500 shrink-0" />
            <h1 className="text-2xl font-bold" data-testid="text-404-title">Seite nicht gefunden</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Die angeforderte Seite existiert nicht oder wurde verschoben.
          </p>
          <Link href="/">
            <Button variant="secondary" className="mt-4" data-testid="button-back-home">
              Zur Startseite
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
