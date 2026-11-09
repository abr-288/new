import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-mint to-white px-4 text-center">
      <div>
        <div className="mb-6 flex justify-center"><Logo /></div>
        <p className="font-hand text-6xl text-sun-dark">404</p>
        <h1 className="mt-2 text-2xl font-bold text-brand-dark">Page introuvable</h1>
        <p className="mt-2 text-sm text-slate-600">La page demandée n’existe pas ou n’est plus accessible.</p>
        <Link href="/" className="btn btn-green mt-6">Retour à l’accueil</Link>
      </div>
    </main>
  );
}
