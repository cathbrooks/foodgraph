import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.foodgraph.app",
  appName: "Foodgraph",
  webDir: "out",
  server: {
    // During development, point to the Next.js dev server.
    // Comment this out for production builds.
    url: "http://localhost:3000",
    cleartext: true,
  },
  plugins: {
    GoogleMaps: {
      // Provide keys via native config (Info.plist / AndroidManifest.xml)
    },
  },
};

export default config;
