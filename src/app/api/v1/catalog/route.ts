import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { catalogItems } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await db
    .select({
      id: catalogItems.id, slug: catalogItems.slug, title: catalogItems.title, category: catalogItems.category, kind: catalogItems.kind,
      description: catalogItems.description, unitPrice: catalogItems.unitPrice, unit: catalogItems.unit, currency: catalogItems.id,
    })
    .from(catalogItems)
    .where(eq(catalogItems.active, true))
    .orderBy(asc(catalogItems.category));
  return Response.json({ currency: "XOF", items: items.map(({ currency, ...i }) => (void currency, i)) });
}
