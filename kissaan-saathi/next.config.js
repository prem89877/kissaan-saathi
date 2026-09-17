/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jejwqorlgtkojhmnuvmb.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
