import Script from "next/script";

/**
 * Cloudflare Web Analytics: free, no traffic cap, no cookies, no personal data, so no consent banner
 * is needed. Counts page views (including client-side navigations, via "spa": true), referrers,
 * countries and devices. Renders nothing unless NEXT_PUBLIC_CF_ANALYTICS_TOKEN is set.
 */
export function Analytics() {
  const token = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) return null;
  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token, spa: true })}
    />
  );
}
