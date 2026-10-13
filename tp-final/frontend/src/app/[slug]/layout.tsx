import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { obtenerCentro } from '@/lib/centro';

/**
 * Todas las páginas de un centro pasan por acá. Si la API dice que el centro no existe o está
 * dado de baja, el segmento entero es un 404, panel incluido: antes, cualquier URL armaba una
 * landing con el nombre sacado del slug.
 *
 * El 404 lo dibuja `app/not-found.tsx`: el `notFound()` de un layout lo atrapa el segmento de
 * arriba, no el propio.
 */
export default async function LayoutCentro({ children, params }: LayoutProps<'/[slug]'>) {
  const { slug } = await params;
  if (!(await obtenerCentro(slug))) notFound();
  return children;
}

/**
 * El nombre del centro en la pestaña y en la vista previa del link. La plantilla aplica a las
 * páginas hijas ("Tu pago · Lo de Lili"); la portada, que es de este mismo segmento, se queda
 * con el `default`.
 */
export async function generateMetadata({ params }: LayoutProps<'/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const centro = await obtenerCentro(slug);
  if (!centro) return {};
  return { title: { default: centro.nombre, template: `%s · ${centro.nombre}` } };
}
