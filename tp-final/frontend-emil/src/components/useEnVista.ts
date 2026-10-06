"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dispara una vez cuando el elemento entra en viewport. Lo usan las secciones para revelar y
 * para arrancar el flip del tablero recién cuando se ve, no antes.
 */
export function useEnVista<T extends HTMLElement = HTMLDivElement>(
  margen = "0px 0px -12% 0px",
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Sin soporte, revelamos todo; diferido para no setear estado sincrónico en el efecto.
      queueMicrotask(() => setVisible(true));
      return;
    }
    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: margen, threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [margen]);

  return [ref, visible];
}
