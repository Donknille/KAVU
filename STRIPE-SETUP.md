# Stripe-Integration auf Vercel einrichten

## Voraussetzungen

- Stripe-Konto vorhanden (stripe.com)
- Vercel-Projekt ist deployed und erreichbar
- `npm run db:push` wurde gegen die Produktions-DB ausgeführt

---

## Schritt 1 – Stripe-Produkt und Preis anlegen

1. Stripe-Dashboard öffnen → **Produktkatalog** → **Produkt erstellen**
2. Name: `Meisterplaner Pro`
3. Preis hinzufügen:
   - Betrag: `29,90 €`
   - Intervall: `Monatlich`
   - Währung: `EUR`
4. Produkt speichern
5. Die **Preis-ID** notieren – sieht aus wie `price_1AbCdEfGhIjKlMnO`

---

## Schritt 2 – API-Keys aus Stripe holen

Stripe-Dashboard → **Entwickler** → **API-Schlüssel**

| Key | Wo zu finden |
|---|---|
| `STRIPE_SECRET_KEY` | "Geheimschlüssel" – beginnt mit `sk_live_...` |

> Für Tests zuerst `sk_test_...` verwenden, dann auf `sk_live_...` wechseln.

---

## Schritt 3 – Webhook in Stripe einrichten

1. Stripe-Dashboard → **Entwickler** → **Webhooks** → **Endpunkt hinzufügen**
2. Endpunkt-URL:
   ```
   https://deine-app.vercel.app/api/billing/webhook
   ```
3. Zu lauschende Events auswählen:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Endpunkt speichern
5. **Signing Secret** kopieren – sieht aus wie `whsec_...`

---

## Schritt 4 – Environment Variables in Vercel setzen

Vercel-Dashboard → dein Projekt → **Settings** → **Environment Variables**

Folgende Variablen hinzufügen (alle Environments: Production, Preview, Development):

| Variable | Wert | Beschreibung |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe Secret Key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Webhook Signing Secret |
| `STRIPE_PRICE_ID` | `price_...` | ID des monatlichen Preises |

---

## Schritt 5 – Customer Portal aktivieren

1. Stripe-Dashboard → **Einstellungen** → **Billing** → **Customer portal**
2. **Aktivieren**
3. Folgende Optionen konfigurieren:
   - Abonnements kündigen: **Ja** (oder Nein, je nach Präferenz)
   - Zahlungsmethode aktualisieren: **Ja**
   - Rechnungshistorie anzeigen: **Ja**
4. **Speichern**

> Ohne diesen Schritt schlägt `POST /api/billing/portal-session` fehl.

---

## Schritt 6 – Deployment auslösen

Nach dem Setzen der Env-Vars:

1. Vercel-Dashboard → **Deployments** → **Redeploy** (letztes Deployment)
   oder neuen Commit pushen
2. Warten bis Deployment abgeschlossen

---

## Schritt 7 – Testen

1. Als Admin einloggen → **Abonnement** in der Seitenleiste öffnen
2. **Jetzt abonnieren** klicken → Stripe Checkout öffnet sich
3. Testkarte verwenden: `4242 4242 4242 4242`, beliebiges Datum, beliebige CVC
4. Nach Zahlung → Weiterleitung zurück zur App
5. Status sollte auf **Aktiv** wechseln

---

## Wichtige Hinweise

- **Webhook zuerst registrieren**, bevor du Testzahlungen machst – sonst bekommt die App keine Bestätigung
- Den **Test-Modus** (`sk_test_...`) vollständig testen, bevor du auf Live (`sk_live_...`) umstellst
- Für Test-Webhooks lokal: Stripe CLI nutzen mit `stripe listen --forward-to localhost:5000/api/billing/webhook`
- Die Datenbank muss die neuen Spalten kennen: `npm run db:push` einmalig ausführen (falls noch nicht geschehen)

---

## Was passiert automatisch

| Ereignis | Was die App tut |
|---|---|
| `checkout.session.completed` | `subscriptionStatus → active`, `currentPeriodEnd` wird gesetzt |
| `customer.subscription.updated` | Status und Laufzeitende werden aktualisiert |
| `customer.subscription.deleted` | Status → `canceled`, App friert ein |
| Zahlung fehlgeschlagen (Stripe intern) | Status → `past_due`, App friert nach Grace-Period ein |
