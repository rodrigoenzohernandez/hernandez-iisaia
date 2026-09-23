import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deja en .next/standalone un server.js con solo las dependencias que el runtime usa,
  // para que la imagen final no cargue node_modules entero. El Dockerfile copia a mano
  // `public` y `.next/static`, que el standalone no incluye a propósito.
  output: "standalone",
};

export default nextConfig;
