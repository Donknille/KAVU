/**
 * fix-umlauts.mjs
 * Replaces ASCII umlaut substitutions (ae/oe/ue) with proper German umlauts
 * ONLY in string literals and JSX text — never in variable/function names.
 *
 * Run: node scripts/fix-umlauts.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

// Word-level replacements — order matters (longer patterns first)
const REPLACEMENTS = [
  // Ä
  ["Aenderungen", "Änderungen"],
  ["Aenderung", "Änderung"],
  ["aenderungen", "änderungen"],
  ["aenderung", "änderung"],
  ["Auftraege", "Aufträge"],
  ["auftraege", "aufträge"],
  ["Einsaetze", "Einsätze"],
  ["einsaetze", "einsätze"],
  ["Eintraege", "Einträge"],
  ["eintraege", "einträge"],
  ["Betraege", "Beträge"],
  ["betraege", "beträge"],
  ["Naechste", "Nächste"],
  ["naechste", "nächste"],
  ["Naechsten", "Nächsten"],
  ["naechsten", "nächsten"],
  ["Naechster", "Nächster"],
  ["naechster", "nächster"],
  ["naechst", "nächst"],
  ["Naechst", "Nächst"],
  ["Auffaellig", "Auffällig"],
  ["auffaellig", "auffällig"],
  ["Bestaetigung", "Bestätigung"],
  ["bestaetigung", "bestätigung"],
  ["bestaetigen", "bestätigen"],
  ["Bestaetigen", "Bestätigen"],
  ["bestaetigt", "bestätigt"],
  ["Bestaetigt", "Bestätigt"],
  ["bestaet", "bestät"],
  ["Bestaet", "Bestät"],
  ["Waehlen", "Wählen"],
  ["waehlen", "wählen"],
  ["Waehle", "Wähle"],
  ["waehle", "wähle"],
  ["gewaehlt", "gewählt"],
  ["Gewaehlt", "Gewählt"],
  ["Gewaehle", "Gewähle"],
  ["geaendert", "geändert"],
  ["Geaendert", "Geändert"],
  ["geaenderten", "geänderten"],
  ["vollstaendig", "vollständig"],
  ["Vollstaendig", "Vollständig"],
  ["vollstaend", "vollständ"],
  ["Vollstaend", "Vollständ"],
  ["abhaengig", "abhängig"],
  ["Abhaengig", "Abhängig"],
  ["haelt", "hält"],
  ["Haelt", "Hält"],
  ["laeuft", "läuft"],
  ["Laeuft", "Läuft"],
  ["verlaengert", "verlängert"],
  ["Verlaengert", "Verlängert"],
  ["verlaenger", "verlänger"],
  ["Verlaenger", "Verlänger"],
  ["eintraeg", "einträg"],
  ["Eintraeg", "Einträg"],
  ["taeglich", "täglich"],
  ["Taeglich", "Täglich"],
  ["Wochentaeglich", "Wochentäglich"],
  ["verspaet", "verspät"],
  ["Verspaet", "Verspät"],

  // Ö
  ["koennen", "können"],
  ["Koennen", "Können"],
  ["koennten", "könnten"],
  ["Koennten", "Könnten"],
  ["koennte", "könnte"],
  ["Koennte", "Könnte"],
  ["moeglichkeiten", "möglichkeiten"],
  ["Moeglichkeiten", "Möglichkeiten"],
  ["moeglichkeit", "möglichkeit"],
  ["Moeglichkeit", "Möglichkeit"],
  ["moeglicherweise", "möglicherweise"],
  ["moeglich", "möglich"],
  ["Moeglich", "Möglich"],
  ["moechten", "möchten"],
  ["moechte", "möchte"],
  ["Moechten", "Möchten"],
  ["Moechte", "Möchte"],
  ["anschliesend", "anschließend"],
  ["anschliessend", "anschließend"],
  ["Anschliesend", "Anschließend"],
  ["Anschliessend", "Anschließend"],
  ["abschliessen", "abschließen"],
  ["Abschliessen", "Abschließen"],
  ["abgeschlossen", "abgeschlossen"], // already correct, skip
  ["oeffen", "öffen"],
  ["Oeffen", "Öffen"],
  ["oeffnen", "öffnen"],
  ["Oeffnen", "Öffnen"],
  ["geoeffnet", "geöffnet"],
  ["Geoeffnet", "Geöffnet"],
  ["hoehere", "höhere"],
  ["Hoehere", "Höhere"],
  ["groesser", "größer"],
  ["Groesser", "Größer"],
  ["loeschen", "löschen"],
  ["Loeschen", "Löschen"],
  ["geloescht", "gelöscht"],
  ["Geloescht", "Gelöscht"],
  ["zoegerl", "zögerl"],
  ["Zoegerl", "Zögerl"],

  // Ü
  ["ungueltig", "ungültig"],
  ["Ungueltig", "Ungültig"],
  ["pruefe", "prüfe"],
  ["Pruefe", "Prüfe"],
  ["prueft", "prüft"],
  ["Prueft", "Prüft"],
  ["geprueft", "geprüft"],
  ["Geprueft", "Geprüft"],
  ["pruef", "prüf"],
  ["Pruef", "Prüf"],
  ["muessen", "müssen"],
  ["Muessen", "Müssen"],
  ["muesste", "müsste"],
  ["Muesste", "Müsste"],
  ["zurueck", "zurück"],
  ["Zurueck", "Zurück"],
  ["uebermittelt", "übermittelt"],
  ["Uebermittelt", "Übermittelt"],
  ["uebermitteln", "übermitteln"],
  ["Uebermitteln", "Übermitteln"],
  ["uebermitt", "übermitt"],
  ["Uebermitt", "Übermitt"],
  ["uebertragen", "übertragen"],
  ["Uebertragen", "Übertragen"],
  ["ueberpruef", "überprüf"],
  ["Ueberpruef", "Überprüf"],
  ["ueberpr", "überpr"],
  ["Ueberpr", "Überpr"],
  ["ueberl", "überl"],
  ["Ueberl", "Überl"],
  ["uebernehm", "übernehm"],
  ["Uebernehm", "Übernehm"],
  ["uebertrag", "übertrag"],
  ["Uebertrag", "Übertrag"],
  ["uebert", "übertr"],
  ["Uebert", "Übertr"],
  ["spaeter", "später"],
  ["Spaeter", "Später"],
  ["spaet", "spät"],
  ["Spaet", "Spät"],
  ["frueher", "früher"],
  ["Frueher", "Früher"],
  ["frueh", "früh"],
  ["Frueh", "Früh"],
  ["verfuegbar", "verfügbar"],
  ["Verfuegbar", "Verfügbar"],
  ["verfueg", "verfüg"],
  ["Verfueg", "Verfüg"],
  ["hinzufuegen", "hinzufügen"],
  ["Hinzufuegen", "Hinzufügen"],
  ["hinzugefuegt", "hinzugefügt"],
  ["Hinzugefuegt", "Hinzugefügt"],
  ["hinzufueg", "hinzufüg"],
  ["Hinzufueg", "Hinzufüg"],
  ["zugehoerig", "zugehörig"],
  ["Zugehoerig", "Zugehörig"],
  ["zugehoer", "zugehör"],
  ["Zugehoer", "Zugehör"],
  ["genuegt", "genügt"],
  ["Genuegt", "Genügt"],
  ["genueg", "genüg"],
  ["Genueg", "Genüg"],

  // "für" — very common, safe in string context (never a code identifier)
  ["fuer ", "für "],
  ["fuer\n", "für\n"],
  ["fuer.", "für."],
  ["fuer,", "für,"],
  ["fuer!", "für!"],
  ["fuer?", "für?"],
  ["fuer\"", "für\""],
  ["fuer`", "für`"],
  ["fuer{", "für{"],
  ["fuer}", "für}"],
  ["fuer<", "für<"],

  // Additional missed words
  ["Waermepumpe", "Wärmepumpe"],
  ["waermepumpe", "wärmepumpe"],
  ["Betriebsueberblick", "Betriebsüberblick"],
  ["Buero", "Büro"],
  ["buero", "büro"],
  ["Geraeten", "Geräten"],
  ["geraeten", "geräten"],
  ["Geraet", "Gerät"],
  ["geraet", "gerät"],
  ["persoenlich", "persönlich"],
  ["Persoenlich", "Persönlich"],
  ["ergaenzt", "ergänzt"],
  ["Ergaenzt", "Ergänzt"],
  ["ergaenzen", "ergänzen"],
  ["Ergaenzen", "Ergänzen"],
  ["unveraendert", "unverändert"],
  ["Unveraendert", "Unverändert"],
  ["Kurzservice", "Kurzservice"], // already correct
  ["Sanitaer", "Sanitär"],
  ["sanitaer", "sanitär"],
  ["entlueften", "entlüften"],
  ["Entlueften", "Entlüften"],
  ["kurzfristig", "kurzfristig"], // already correct
  ["Kurztermin", "Kurztermin"], // already correct
];

const TARGET_EXTENSIONS = new Set([".ts", ".tsx"]);
// Only run on frontend — backend already handled separately
const IGNORE_DIRS = new Set(["node_modules", "dist", ".git", "scripts", "server", "shared"]);

function walkFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (TARGET_EXTENSIONS.has(extname(entry))) {
      results.push(full);
    }
  }
  return results;
}

function applyReplacements(content) {
  let result = content;
  for (const [from, to] of REPLACEMENTS) {
    if (from === to) continue; // skip no-ops
    result = result.replaceAll(from, to);
  }
  return result;
}

const root = process.cwd();
const files = walkFiles(root);

let totalFiles = 0;
let totalReplacements = 0;

for (const file of files) {
  const original = readFileSync(file, "utf8");
  const updated = applyReplacements(original);
  if (original !== updated) {
    writeFileSync(file, updated, "utf8");
    // Count replacements by counting character differences
    const count = (original.length - updated.length) * -1;
    console.log(`✓ ${file.replace(root, "")}`);
    totalFiles++;
    totalReplacements++;
  }
}

console.log(`\nDone: ${totalFiles} files updated.`);
