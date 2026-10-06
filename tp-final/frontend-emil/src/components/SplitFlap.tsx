"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/*
  Split-flap: el tablero de salidas. Cada celda baraja unos caracteres y se asienta en el
  suyo, escalonada, como un panel que se actualiza. El flip es dos hojas que giran —la de
  arriba de lo viejo cae, la de abajo de lo nuevo entra—; la costura siempre visible lo lee
  como mecánico, no como una carta que gira.

  SSR y sin-JS muestran el texto final directo. `prefers-reduced-motion` también: el estado
  final sin giro.
*/

const CHARSET = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ0123456789$·/%+ ";
const DUR = 140; // ms por paso; el intervalo iguala a la animación, así los pasos no se pisan.

function randChar(): string {
  return CHARSET[(Math.random() * CHARSET.length) | 0];
}

function Media({ ch }: { ch: string }) {
  return <span>{ch === " " ? " " : ch}</span>;
}

function FlapCell({
  target,
  playing,
  delay,
}: {
  target: string;
  playing: boolean;
  delay: number;
}) {
  const up = (target || " ").toUpperCase();
  // step === null: en reposo mostrando el carácter final (SSR, sin-JS, reduced-motion).
  const [step, setStep] = useState<number | null>(null);
  const seqRef = useRef<string[]>([]);

  useEffect(() => {
    if (!playing || step !== null) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const n = 3 + ((Math.random() * 6) | 0);
    const seq = [" "];
    for (let i = 0; i < n; i++) seq.push(randChar());
    seq.push(up);
    seqRef.current = seq;

    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const start = setTimeout(function run() {
      setStep(i);
      if (i < seq.length - 1) {
        i += 1;
        timer = setTimeout(run, DUR);
      }
    }, delay);

    return () => {
      clearTimeout(start);
      clearTimeout(timer);
    };
    // Solo arranca una vez, cuando `playing` pasa a true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // En reposo (final) o en el primer cuadro en blanco: una sola cara con costura.
  if (step === null || step === 0) {
    const ch = step === null ? up : " ";
    return (
      <span className="flap" aria-hidden="true">
        <span className="flap__rest ancha">
          <Media ch={ch} />
        </span>
      </span>
    );
  }

  const seq = seqRef.current;
  const prev = seq[step - 1] ?? " ";
  const cur = seq[step] ?? up;

  return (
    <span className="flap" aria-hidden="true">
      {/* mitades fijas */}
      <span className="flap__half flap__half--top">
        <Media ch={cur} />
      </span>
      <span className="flap__half flap__half--bottom">
        <Media ch={prev} />
      </span>
      {/* hojas que giran, re-montadas por `key` para reiniciar la animación */}
      <span key={`t${step}`} className="flap__leaf flap__leaf--top">
        <Media ch={prev} />
      </span>
      <span key={`b${step}`} className="flap__leaf flap__leaf--bottom">
        <Media ch={cur} />
      </span>
    </span>
  );
}

type Tamano = {
  fontSize: string;
  alto?: string;
  ancho?: string;
};

export function SplitFlap({
  text,
  playing,
  size,
  startDelay = 0,
  stagger = 45,
  className = "",
}: {
  text: string;
  playing: boolean;
  size: Tamano;
  startDelay?: number;
  stagger?: number;
  className?: string;
}) {
  const palabras = text.toUpperCase().split(" ");
  const style: CSSProperties = {
    fontSize: size.fontSize,
    ["--flap-alto" as string]: size.alto ?? "1em",
    ["--flap-ancho" as string]: size.ancho ?? "0.68em",
    ["--flap-dur" as string]: `${DUR}ms`,
  };

  // Índice global de carácter, para que el escalonado sea continuo entre palabras, pero el
  // salto de línea solo pueda caer entre palabras (cada palabra es un grupo nowrap).
  let indice = 0;

  return (
    <span
      className={`inline-flex flex-wrap items-start gap-x-[0.4em] gap-y-[0.18em] ${className}`}
      style={style}
      role="text"
      aria-label={text}
    >
      {palabras.map((palabra, w) => (
        <span key={w} className="inline-flex flex-nowrap">
          {[...palabra].map((ch) => {
            const delay = startDelay + indice * stagger;
            indice += 1;
            return <FlapCell key={`${w}-${ch}-${indice}`} target={ch} playing={playing} delay={delay} />;
          })}
        </span>
      ))}
    </span>
  );
}
