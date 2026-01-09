/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        antd: {
          test: /[\\/]node_modules[\\/]antd[\\/]/,
          name: "antd",
          priority: 100,
        },
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 1000 * 60 * 60,
    pagesBufferLength: 5,
  },
};

export default nextConfig;
