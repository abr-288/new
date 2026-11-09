import type { ReactNode } from "react";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { getCurrentUser } from "@/lib/auth";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  return (
    <>
      <PublicHeader userName={user?.name || user?.phone || null} />
      <main>{children}</main>
      <PublicFooter />
    </>
  );
}
