/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
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
        hostname: "eventbritecdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.eventbritecdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "secure.meetupstatic.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.squarespace-cdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**",
        pathname: "/**",
      },
    ],
  },
}

export default nextConfig
