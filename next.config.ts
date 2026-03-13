import type { NextConfig } from "next";

const isMobileBuild = process.env.CAPACITOR_BUILD === "true";

const nextConfig: NextConfig = {
  ...(isMobileBuild ? { output: "export" } : {}),
};

export default nextConfig;
