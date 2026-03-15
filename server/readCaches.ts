import { TtlCache } from "./ttlCache.js";

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const meResponseCache = new TtlCache<string, unknown>(1000);
const dashboardResponseCache = new TtlCache<string, unknown>(250);
const planningBoardResponseCache = new TtlCache<string, unknown>(500);
const meCacheTtlMs = parsePositiveInt(process.env.ME_CACHE_TTL_MS, 5000);
const dashboardCacheTtlMs = parsePositiveInt(process.env.DASHBOARD_CACHE_TTL_MS, 5000);
const planningBoardCacheTtlMs = parsePositiveInt(process.env.PLANNING_CACHE_TTL_MS, 15000);

export function getCachedMeResponse<T>(cacheKey: string) {
  return meResponseCache.get(cacheKey) as T | undefined;
}

export function setCachedMeResponse(cacheKey: string, payload: unknown) {
  meResponseCache.set(cacheKey, payload, meCacheTtlMs);
}

export function getCachedDashboardResponse<T>(cacheKey: string) {
  return dashboardResponseCache.get(cacheKey) as T | undefined;
}

export function setCachedDashboardResponse(cacheKey: string, payload: unknown) {
  dashboardResponseCache.set(cacheKey, payload, dashboardCacheTtlMs);
}

export function getCachedPlanningBoardResponse<T>(cacheKey: string) {
  return planningBoardResponseCache.get(cacheKey) as T | undefined;
}

export function setCachedPlanningBoardResponse(cacheKey: string, payload: unknown) {
  planningBoardResponseCache.set(cacheKey, payload, planningBoardCacheTtlMs);
}

export function invalidateCompanyReadCaches(companyId: string) {
  meResponseCache.deleteWhere((key) => key.startsWith(`${companyId}:`));
  dashboardResponseCache.deleteWhere((key) => key.startsWith(`${companyId}:`));
  planningBoardResponseCache.deleteWhere((key) => key.startsWith(`${companyId}:`));
}
