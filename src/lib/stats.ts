import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { missions, requests, users } from "@/db/schema";

export type StatFilters = { from?: string; to?: string; status?: string; category?: string; provider?: string; zone?: string };

export async function loadStats(f: StatFilters) {
  const conds: SQL[] = [];
  if (f.from) conds.push(gte(requests.createdAt, new Date(f.from)));
  if (f.to) conds.push(lte(requests.createdAt, new Date(f.to + "T23:59:59")));
  if (f.status) conds.push(eq(requests.status, f.status));
  if (f.category) conds.push(eq(requests.category, f.category));
  const rows = await db.select().from(requests).where(conds.length ? and(...conds) : undefined).orderBy(desc(requests.id));
  const ms = await db.select({ m: missions, pname: users.name }).from(missions).leftJoin(users, eq(users.id, missions.providerId));
  let out = rows.map((r) => {
    const rm = ms.filter(({ m }) => m.requestId === r.id);
    return { r, providers: rm.map((x) => x.pname).filter(Boolean).join(", "), providerIds: rm.map((x) => x.m.providerId), late: rm.some(({ m }) => m.dueDate && m.dueDate < new Date() && ["proposed", "accepted", "in_progress"].includes(m.status)) };
  });
  if (f.provider) out = out.filter((x) => x.providerIds.includes(parseInt(f.provider!, 10)));
  if (f.zone) out = out.filter((x) => (x.r.targetZone ?? "").toLowerCase().includes(f.zone!.toLowerCase()));
  const total = out.length;
  const by = (s: string[]) => out.filter((x) => s.includes(x.r.status)).length;
  const done = out.filter((x) => x.r.completedAt);
  const avgDays = done.length ? done.reduce((s, x) => s + (x.r.completedAt!.getTime() - x.r.createdAt.getTime()) / 86400000, 0) / done.length : 0;
  const decided = by(["accepted", "in_progress", "completed", "closed", "rejected"]);
  const accepted = by(["accepted", "in_progress", "completed", "closed"]);
  return {
    rows: out,
    kpi: {
      received: total, accepted, rejected: by(["rejected"]), realized: by(["completed", "closed"]),
      realizationRate: accepted ? (by(["completed", "closed"]) / accepted) * 100 : 0,
      acceptanceRate: decided ? (accepted / decided) * 100 : 0,
      avgDays, documented: out.reduce((s, x) => s + x.r.executionBudget + x.r.otherFees, 0),
      late: out.filter((x) => x.late).length,
      amount: out.reduce((s, x) => s + x.r.totalAmount, 0),
    },
  };
}
