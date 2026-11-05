import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // exceljs is a Node library; keep it out of the server bundle and load it at runtime.
  serverExternalPackages: ["exceljs"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
