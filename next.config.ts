import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ISR pages revalidate every 60 s; with expireTime 120 the CDN header becomes
  // "s-maxage=60, stale-while-revalidate=60", matching the IEC's own max-age.
  expireTime: 120,
  // Bundle the PartyList fixture so party names resolve even if the IEC is down.
  outputFileTracingIncludes: {
    "/**": ["./fixtures/partylist.json"],
  },
};

export default nextConfig;
