import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { Empty, PageHeader, StatusBadge, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fcfa, fdate, PAY_METHODS, PAYMENT_STATUS } from "@/lib/format";

export default async function Page() {
  const u = await requireUser();
  const rows = await db.select().from(payments).where(eq(payments.userId, u.id)).orderBy(desc(payments.id));
  const provider = u.role === "provider";
  return (
    <>
      <PageHeader title={provider ? "Mes rémunérations" : "Mes paiements"} subtitle="Montants prévus, validés, payés et restant dus. Vous ne voyez que vos propres opérations." />
      {rows.length === 0 ? <Empty>Aucune opération financière.</Empty> : (
        <Table>
          <thead><tr><th>Objet</th><th>Mode</th><th>Prévu</th><th>Validé</th><th>Payé</th><th>Reste dû</th><th>Échéance</th><th>Statut</th><th>Pièce</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.requestId ? <Link className="font-semibold text-brand hover:underline" href={provider ? "/espace/missions" : `/espace/demandes/${p.requestId}`}>{p.note}</Link> : p.note}</td>
                <td>{p.mode === "exchange" ? <>Échange de services<br /><span className="text-xs text-slate-500">{p.exchangeDescription} ({p.exchangeStatus})</span></> : PAY_METHODS[p.method ?? ""] ?? "—"}</td>
                <td>{fcfa(p.amountPlanned)}</td>
                <td>{p.amountValidated != null ? fcfa(p.amountValidated) : "—"}</td>
                <td>{fcfa(p.amountPaid)}</td>
                <td>{p.mode === "exchange" ? "—" : fcfa(Math.max((p.amountValidated ?? p.amountPlanned) - p.amountPaid, 0))}</td>
                <td>{fdate(p.dueDate)}</td>
                <td><StatusBadge meta={PAYMENT_STATUS} value={p.status} /></td>
                <td>{p.receiptPath ? <a className="text-xs font-semibold text-brand underline" href={`/api/files/receipt/${p.id}`} target="_blank">Reçu</a> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
