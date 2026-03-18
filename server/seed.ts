import { db } from "./db.js";
import {
  companies,
  employees,
  jobs,
  assignments,
  assignmentWorkers,
  timeEntries,
} from "../shared/schema.js";
import { eq, sql } from "drizzle-orm";
import { PREVIEW_MODE } from "./preview.js";
import { ENABLE_DEMO_SEED } from "./runtimeConfig.js";

export async function seedDatabase() {
  if (PREVIEW_MODE || !ENABLE_DEMO_SEED) return;

  const existingCompanies = await db.select().from(companies);
  if (existingCompanies.length > 0) return;

  console.log("Seeding database with demo data...");

  const [company] = await db
    .insert(companies)
    .values({
      name: "Müller Solartechnik GmbH",
      phone: "+49 89 123456",
    })
    .returning();

  const empData = [
    { firstName: "Thomas", lastName: "Müller", phone: "+49 171 1111111", role: "admin" as const, color: "#3b82f6" },
    { firstName: "Stefan", lastName: "Weber", phone: "+49 171 2222222", role: "admin" as const, color: "#8b5cf6" },
    { firstName: "Marco", lastName: "Schneider", phone: "+49 172 3333333", role: "employee" as const, color: "#10b981" },
    { firstName: "Andreas", lastName: "Fischer", phone: "+49 172 4444444", role: "employee" as const, color: "#f59e0b" },
    { firstName: "Jens", lastName: "Hoffmann", phone: "+49 173 5555555", role: "employee" as const, color: "#ef4444" },
    { firstName: "Patrick", lastName: "Braun", phone: "+49 173 6666666", role: "employee" as const, color: "#06b6d4" },
    { firstName: "Daniel", lastName: "Zimmermann", phone: "+49 174 7777777", role: "employee" as const, color: "#ec4899" },
  ];

  const createdEmps = [];
  for (const emp of empData) {
    const [e] = await db
      .insert(employees)
      .values({ ...emp, companyId: company.id, isActive: true })
      .returning();
    createdEmps.push(e);
  }

  const today = new Date();
  const monday = new Date(today);
  const dayOfWeek = monday.getDay();
  monday.setDate(monday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const getDate = (offset: number) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  let jobNum = 0;
  const nextJobNumber = () => `A-${String(++jobNum).padStart(4, "0")}`;

  const jobsData = [
    {
      title: "PV-Anlage Dach 12kWp",
      customerName: "Familie Schmidt",
      addressStreet: "Sonnenallee 15",
      addressZip: "80331",
      addressCity: "München",
      contactName: "Herr Schmidt",
      contactPhone: "+49 89 9876543",
      description: "Installation einer 12kWp PV-Anlage auf Süddach, inkl. Wechselrichter und Speicher.",
      category: "pv" as const,
      status: "in_progress" as const,
      startDate: getDate(0),
    },
    {
      title: "Wärmepumpe Neubau",
      customerName: "Bauprojekt Meier",
      addressStreet: "Gartenweg 8",
      addressZip: "81369",
      addressCity: "München",
      contactName: "Frau Meier",
      contactPhone: "+49 89 5551234",
      description: "Luft-Wasser-Wärmepumpe im Neubau installieren. Fundamentarbeiten bereits abgeschlossen.",
      category: "heat_pump" as const,
      status: "planned" as const,
      startDate: getDate(2),
    },
    {
      title: "Service PV-Anlage",
      customerName: "Gewerbe Münchner Str.",
      addressStreet: "Münchner Str. 42",
      addressZip: "82131",
      addressCity: "Gauting",
      contactName: "Herr Berger",
      contactPhone: "+49 89 4445566",
      description: "Jahresservice, Module reinigen, Wechselrichter prüfen.",
      category: "service" as const,
      status: "planned" as const,
    },
    {
      title: "SHK Sanierung Bad",
      customerName: "Frau Dr. Lehmann",
      addressStreet: "Lindenstr. 3",
      addressZip: "80802",
      addressCity: "München",
      contactName: "Frau Dr. Lehmann",
      contactPhone: "+49 89 7778899",
      description: "Komplette Badsanierung: Heizungsleitungen, Warmwasser, Fußbodenheizung.",
      category: "shk" as const,
      status: "planned" as const,
      startDate: getDate(3),
    },
    {
      title: "PV Montage Flachdach",
      customerName: "Autohaus Gruber",
      addressStreet: "Industriestr. 22",
      addressZip: "85748",
      addressCity: "Garching",
      contactName: "Herr Gruber",
      contactPhone: "+49 89 3334455",
      description: "30kWp PV-Anlage auf Flachdach Autohaus.",
      internalNote: "Kran wird am Montag geliefert. Achtung: Dachstatik-Gutachten liegt vor.",
      category: "pv" as const,
      status: "planned" as const,
      startDate: getDate(4),
    },
    {
      title: "Wärmepumpe Wartung",
      customerName: "Pension Alpenblick",
      addressStreet: "Bergstr. 7",
      addressZip: "82467",
      addressCity: "Garmisch",
      contactName: "Herr Huber",
      contactPhone: "+49 8821 12345",
      description: "Jahreswartung Wärmepumpe, Kältemittel prüfen.",
      category: "heat_pump" as const,
      status: "completed" as const,
    },
    {
      title: "Montage Solarcarport",
      customerName: "Praxis Dr. Wagner",
      addressStreet: "Hauptstr. 55",
      addressZip: "82319",
      addressCity: "Starnberg",
      contactName: "Frau Wagner",
      contactPhone: "+49 8151 67890",
      description: "Solarcarport mit 8 Modulen und Wallbox-Vorbereitung.",
      category: "montage" as const,
      status: "in_progress" as const,
      startDate: getDate(1),
    },
    {
      title: "Heizung Notdienst",
      customerName: "Familie Becker",
      addressStreet: "Am Waldrand 11",
      addressZip: "82041",
      addressCity: "Oberhaching",
      contactName: "Herr Becker",
      contactPhone: "+49 89 2223344",
      description: "Heizung ausgefallen, schnellstmögliche Reparatur.",
      category: "service" as const,
      status: "planned" as const,
    },
  ];

  const createdJobs = [];
  for (const j of jobsData) {
    const [job] = await db
      .insert(jobs)
      .values({ ...j, companyId: company.id, jobNumber: nextJobNumber() })
      .returning();
    createdJobs.push(job);
  }

  const assignmentsData = [
    { jobIdx: 0, date: getDate(0), workers: [2, 3], start: "07:30", end: "16:00", status: "on_site" as const },
    { jobIdx: 0, date: getDate(1), workers: [2, 3], start: "07:30", end: "16:00", status: "planned" as const },
    { jobIdx: 6, date: getDate(1), workers: [4, 5], start: "08:00", end: "15:00", status: "on_site" as const },
    { jobIdx: 1, date: getDate(2), workers: [2, 4], start: "07:00", end: "16:00", status: "planned" as const },
    { jobIdx: 3, date: getDate(3), workers: [5, 6], start: "08:00", end: "17:00", status: "planned" as const },
    { jobIdx: 4, date: getDate(4), workers: [2, 3, 4], start: "07:00", end: "17:00", status: "planned" as const },
    { jobIdx: 7, date: getDate(0), workers: [6], start: "09:00", end: "12:00", status: "planned" as const },
  ];

  for (const aData of assignmentsData) {
    const [assignment] = await db
      .insert(assignments)
      .values({
        companyId: company.id,
        jobId: createdJobs[aData.jobIdx].id,
        assignmentDate: aData.date,
        plannedStartTime: aData.start,
        plannedEndTime: aData.end,
        status: aData.status,
      })
      .returning();

    for (const wIdx of aData.workers) {
      await db.insert(assignmentWorkers).values({
        companyId: company.id,
        assignmentId: assignment.id,
        employeeId: createdEmps[wIdx].id,
      });
    }

    if (aData.status === "on_site") {
      for (const wIdx of aData.workers) {
        const startTime = new Date();
        startTime.setHours(7, 30, 0, 0);
        const arriveTime = new Date();
        arriveTime.setHours(8, 15, 0, 0);
        await db.insert(timeEntries).values({
          companyId: company.id,
          jobId: createdJobs[aData.jobIdx].id,
          assignmentId: assignment.id,
          employeeId: createdEmps[wIdx].id,
          startedAt: startTime,
          arrivedAt: arriveTime,
          status: "on_site",
        });
      }
    }

  }

  console.log("Seed data created successfully.");
}
