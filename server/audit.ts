// T-305 audit log. Fire-and-forget helper that writes an append-only row
// into public.audit_events for every relevant mutation. Failures are
// logged and swallowed so an audit failure can never break a user-facing
// request.

import type { Request } from "express";
import { db } from "./db.js";
import { auditEvents } from "../shared/schema.js";

export type AuditEventInput = {
  companyId?: string | null;
  actorUserId?: string | null;
  actorEmployeeId?: string | null;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  payload?: unknown;
  request?: Pick<Request, "ip" | "headers"> | null;
};

function extractIp(req: AuditEventInput["request"]): string | null {
  if (!req) return null;
  const ip = req.ip ?? null;
  if (!ip) return null;
  return ip.slice(0, 64);
}

function extractUserAgent(req: AuditEventInput["request"]): string | null {
  if (!req) return null;
  const ua = req.headers?.["user-agent"];
  if (Array.isArray(ua)) return ua[0]?.slice(0, 500) ?? null;
  if (typeof ua === "string") return ua.slice(0, 500);
  return null;
}

export function logAuditEvent(event: AuditEventInput): void {
  const payloadString = event.payload === undefined ? null : JSON.stringify(event.payload);
  void db
    .insert(auditEvents)
    .values({
      companyId: event.companyId ?? null,
      actorUserId: event.actorUserId ?? null,
      actorEmployeeId: event.actorEmployeeId ?? null,
      actorIp: extractIp(event.request),
      eventType: event.eventType,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      payload: payloadString,
      userAgent: extractUserAgent(event.request),
    })
    .catch((err) => {
      console.error("[audit] failed to record event", event.eventType, err);
    });
}
