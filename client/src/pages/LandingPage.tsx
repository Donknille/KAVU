import { Button } from "@/components/ui/button";
  import { Card } from "@/components/ui/card";
  import { HardHat, Clock, Camera, ClipboardCheck, ArrowRight } from "lucide-react";

  export default function LandingPage() {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
                <HardHat className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">Der Digitale Polier</span>
            </div>
            <a href="/api/login" data-testid="button-login-header">
              <Button size="sm">Anmelden</Button>
            </a>
          </div>
        </header>

        <main className="flex-1">
          <section className="py-20 px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6" data-testid="text-hero-title">
                Einsatzplanung, Zeiterfassung & Nachweis
                <br />
                <span className="text-muted-foreground">für kleine Handwerksbetriebe</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
                Wer ist heute wo? Was ist zu tun? Wie viele Stunden wurden geleistet?
                Einfach, mobil, sofort einsatzbereit.
              </p>
              <a href="/api/login" data-testid="button-login-hero">
                <Button size="lg" className="h-14 px-8 text-lg gap-2">
                  Jetzt starten
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </a>
              <p className="text-sm text-muted-foreground mt-3">
                Kostenlos loslegen • Keine Kreditkarte nötig
              </p>
            </div>
          </section>

          <section className="py-16 px-4 bg-card/50">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-center mb-10">
                Drei Fragen – eine App
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="p-6">
                  <div className="w-10 h-10 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                    <ClipboardCheck className="w-5 h-5 text-blue-700 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Wer ist heute wo?</h3>
                  <p className="text-muted-foreground text-sm">
                    Einsatzplan auf einen Blick. Mitarbeiter, Aufträge und Tage – alles in einer Übersicht.
                  </p>
                </Card>
                <Card className="p-6">
                  <div className="w-10 h-10 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                    <Clock className="w-5 h-5 text-green-700 dark:text-green-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Was ist der Status?</h3>
                  <p className="text-muted-foreground text-sm">
                    Fahrt, Ankunft, Pause, Fertig – klare Statusaktionen per Knopfdruck. Kein Rätselraten.
                  </p>
                </Card>
                <Card className="p-6">
                  <div className="w-10 h-10 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                    <Camera className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Nachweis erbracht?</h3>
                  <p className="text-muted-foreground text-sm">
                    Zeiten, Fotos, Probleme – alles dokumentiert. Exportbereit für Büro und Abrechnung.
                  </p>
                </Card>
              </div>
            </div>
          </section>

          <section className="py-16 px-4">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-2xl font-bold mb-4">Gebaut für die Baustelle</h2>
              <p className="text-muted-foreground mb-6">
                Große Buttons, klare Farben, mobile Bedienung – auch mit schmutzigen Händen und wenig Zeit.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {["PV / Solar", "Wärmepumpen", "SHK", "Montage", "Service"].map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 rounded-md bg-muted text-sm text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t py-6 px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Der Digitale Polier
        </footer>
      </div>
    );
  }
  