import Link from "next/link";

// Index of the prototype surfaces.

const SURFACES = [
  { href: "/preview/home", title: "Hoy", note: "El home fusionado: una promesa, un botón" },
  { href: "/preview/lesson", title: "Introducción de lección", note: "La idea, con voz y contexto" },
  { href: "/preview/exercise", title: "Cáscara de ejercicio", note: "Un motor de práctica, seis modos" },
  { href: "/preview/feedback", title: "Feedback y cierre", note: "La anatomía única + el sello" },
  { href: "/preview/talk", title: "Hablar", note: "Entrada y conversación con presencia de Joel" },
  { href: "/preview/progress", title: "Camino", note: "Progreso hacia el trabajo, honesto" },
  { href: "/preview/yo", title: "Yo", note: "Perfil, progreso y ajustes en un lugar" },
  { href: "/preview/system", title: "Sistema", note: "Tokens, componentes y estados" },
];

export default function PreviewIndex() {
  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <p className="type-label">Prototipo</p>
      <h1 className="type-display mt-2">Clara, premium</h1>
      <p className="type-support mt-3 max-w-[46ch]">
        Las superficies clave del rediseño, aisladas de la app real. Nada aquí toca
        datos, cuentas ni el trabajo de Phase 0.
      </p>
      <ul className="mt-8 divide-y divide-hairline overflow-hidden rounded-3xl border border-hairline bg-card">
        {SURFACES.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex items-baseline justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted">
              <span className="type-heading">{s.title}</span>
              <span className="type-support text-right">{s.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
