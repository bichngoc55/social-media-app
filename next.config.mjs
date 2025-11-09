/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tối ưu compile time
  swcMinify: true,
  // Loại bỏ removeConsole để tương thích với Turbopack
  // Có thể dùng SWC minify để remove console trong production build
  compiler: process.env.TURBOPACK ? undefined : {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },
  // Tối ưu compile performance
  typescript: {
    // Tắt type checking trong build (nhanh hơn, nhưng nên dùng CI/CD để check)
    ignoreBuildErrors: false,
  },
  eslint: {
    // Tắt ESLint trong build (nhanh hơn, nhưng nên dùng CI/CD để check)
    ignoreDuringBuilds: false,
  },
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
    // Tối ưu build performance
    optimizePackageImports: [
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-select",
      "@radix-ui/react-slot",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-tooltip",
      "lucide-react",
      "date-fns",
      "@tanstack/react-query",
      "@tanstack/react-query-devtools",
    ],
    // Giảm số modules được compile
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
  webpack: (config, { isServer, dev, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Exclude .node files from client bundle
    config.module.rules.push({
      test: /\.node$/,
      use: "ignore-loader",
    });

    // Fix stream-chat-react CSS font loading issues
    // Ignore missing .eot files (IE fallbacks, not needed for modern browsers)
    // Use IgnorePlugin to prevent webpack from trying to resolve these files
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\.\/assets\/icons\/stream-chat-icons\.eot(#iefix)?$/,
        contextRegExp: /node_modules\/stream-chat-react/,
      })
    );

    // Handle other font files normally if they exist
    config.module.rules.push({
      test: /\.(woff|woff2|ttf|otf|svg)$/,
      type: "asset/resource",
      include: /node_modules\/stream-chat-react/,
      generator: {
        filename: "static/fonts/[name][ext]",
      },
    });

    // Tối ưu trong development
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }

    // Tối ưu bundle splitting - tách heavy packages
    // Chỉ áp dụng khi không dùng Turbopack (Turbopack tự động optimize)
    if (!isServer && !process.env.TURBOPACK) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            default: false,
            vendors: false,
            // Tách stream-chat vào chunk riêng
            streamChat: {
              name: "stream-chat",
              test: /[\\/]node_modules[\\/](stream-chat|@stream-chat)[\\/]/,
              chunks: "all",
              priority: 30,
            },
            // Tách tiptap vào chunk riêng
            tiptap: {
              name: "tiptap",
              test: /[\\/]node_modules[\\/](@tiptap)[\\/]/,
              chunks: "all",
              priority: 25,
            },
            // Tách Radix UI vào chunk riêng
            radix: {
              name: "radix-ui",
              test: /[\\/]node_modules[\\/](@radix-ui)[\\/]/,
              chunks: "all",
              priority: 20,
            },
            // Vendor chunk cho các packages khác
            vendor: {
              name: "vendor",
              test: /[\\/]node_modules[\\/]/,
              chunks: "all",
              priority: 10,
            },
          },
        },
      };
    }

    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
        pathname: `/**`,
      },
      {
        protocol: "https",
        hostname: "uploadthing-prod-sea1.s3.us-west-2.amazonaws.com",
        pathname: "/**",
      },
      { protocol: "https", hostname: "i.pravatar.cc", pathname: "/**" },
    ],
  },
  rewrites: () => {
    return [
      {
        source: "/hashtag/:tag",
        destination: "/search?q=%23:tag",
      },
    ];
  },
};

export default nextConfig;
