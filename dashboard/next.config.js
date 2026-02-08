const path = require("path");
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  async redirects() {
    return [
      { source: "/favicon.ico", destination: "/icon.svg", permanent: false },
      // "eng" typo: redirect to correct locale (de or en)
      { source: "/de/eng", destination: "/de", permanent: false },
      { source: "/de/eng/", destination: "/de", permanent: false },
      { source: "/de/eng/:path*", destination: "/de/:path*", permanent: false },
      { source: "/en/eng", destination: "/en", permanent: false },
      { source: "/en/eng/", destination: "/en", permanent: false },
      { source: "/en/eng/:path*", destination: "/en/:path*", permanent: false },
      // /eng alone -> English
      { source: "/eng", destination: "/en", permanent: false },
      { source: "/eng/", destination: "/en", permanent: false },
      { source: "/eng/:path*", destination: "/en/:path*", permanent: false },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
