/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      // Eventbrite CDN
      {
        protocol: "https",
        hostname: "img.evbuc.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.evbuc.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.evbuc.com",
        pathname: "/**",
      },
      // Eventbrite (apex + subdomains, e.g. www.eventbrite.com.au)
      {
        protocol: "https",
        hostname: "eventbrite.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.eventbrite.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.eventbrite.com.au",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.eventbrite.co.uk",
        pathname: "/**",
      },
      // Catch-all for other image hosts (e.g. Unsplash, future CDNs)
      {
        protocol: "https",
        hostname: "**",
        pathname: "/**",
      },
    ],
  },
}

export default nextConfig
