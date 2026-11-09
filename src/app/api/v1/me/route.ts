import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await getCurrentUser();
  if (!u) return Response.json({ error: "unauthenticated" }, { status: 401 });
  return Response.json({
    id: u.id, phone: u.phone, name: u.name, role: u.role, permissions: u.permissions, zone: u.zone,
    tokenBalance: u.tokenBalance, tokensEarned: u.tokensEarned,
  });
}
