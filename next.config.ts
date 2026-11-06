import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Bundle the PartyList fixture so party names resolve even if the IEC is down.
  outputFileTracingIncludes: {
    "/**": ["./fixtures/partylist.json"],
  },
};

export default nextConfig;
