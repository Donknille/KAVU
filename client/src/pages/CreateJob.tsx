import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { JOB_CATEGORY_LABELS } from "@/lib/constants";

export default function CreateJob() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    customerName: "",
    addressStreet: "",
    addressZip: "",
    addressCity: "",
    contactName: "",
    contactPhone: "",
    description: "",
    internalNote: "",
    category: "",
    startDate: "",
  });

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.customerName) return;
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/jobs", {
        ...form,
        category: form.category || undefined,
        startDate: form.startDate || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/unassigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Auftrag erstellt" });
      navigate("/jobs");
    } catch {
      toast({
        title: "Fehler",
        description: "Auftrag konnte nicht erstellt werden",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 -ml-2 mb-4"
        onClick={() => window.history.back()}
        data-testid="button-back-create"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück
      </Button>

      <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Plus className="w-5 h-5" />
        Neuer Auftrag
      </h1>

      <form onSubmit={handleSubmit}>
        <Card className="p-4 space-y-4">
          <div>
            <Label>Auftragsbezeichnung *</Label>
            <Input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="z.B. PV-Anlage Dach Montage"
              required
              data-testid="input-job-title"
            />
          </div>
          <div>
            <Label>Kundenname *</Label>
            <Input
              value={form.customerName}
              onChange={(e) => update("customerName", e.target.value)}
              placeholder="z.B. Familie Schmidt"
              required
              data-testid="input-customer-name"
            />
          </div>
          <div>
            <Label>Kategorie</Label>
            <Select value={form.category} onValueChange={(v) => update("category", v)}>
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder="Kategorie wählen" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(JOB_CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium text-sm mb-3">Baustellenadresse</h3>
            <div className="space-y-3">
              <div>
                <Label>Straße</Label>
                <Input
                  value={form.addressStreet}
                  onChange={(e) => update("addressStreet", e.target.value)}
                  placeholder="Musterstraße 12"
                  data-testid="input-street"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>PLZ</Label>
                  <Input
                    value={form.addressZip}
                    onChange={(e) => update("addressZip", e.target.value)}
                    placeholder="12345"
                    data-testid="input-zip"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Stadt</Label>
                  <Input
                    value={form.addressCity}
                    onChange={(e) => update("addressCity", e.target.value)}
                    placeholder="Musterstadt"
                    data-testid="input-city"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium text-sm mb-3">Ansprechpartner</h3>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) => update("contactName", e.target.value)}
                  placeholder="Herr/Frau..."
                  data-testid="input-contact-name"
                />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input
                  value={form.contactPhone}
                  onChange={(e) => update("contactPhone", e.target.value)}
                  placeholder="+49..."
                  data-testid="input-contact-phone"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div>
              <Label>Aufgabenbeschreibung</Label>
              <Textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Was ist zu tun?"
                data-testid="input-description"
              />
            </div>
            <div className="mt-3">
              <Label>Interne Notiz</Label>
              <Textarea
                value={form.internalNote}
                onChange={(e) => update("internalNote", e.target.value)}
                placeholder="Nur für das Büro sichtbar..."
                data-testid="input-internal-note"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <Label>Geplanter Start</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => update("startDate", e.target.value)}
              data-testid="input-start-date"
            />
          </div>
        </Card>

        <Button
          type="submit"
          className="w-full h-12 text-base mt-4"
          disabled={isLoading || !form.title || !form.customerName}
          data-testid="button-create-job"
        >
          {isLoading ? "Wird erstellt..." : "Auftrag erstellen"}
        </Button>
      </form>
    </div>
  );
}
