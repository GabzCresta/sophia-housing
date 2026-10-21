import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A raiz do app é web/ (a raiz do repo tem outro package-lock.json, do lado de ingestão).
  turbopack: { root: __dirname },
};

export default nextConfig;
