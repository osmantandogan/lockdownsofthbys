// craco.config.js
const path = require("path");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === 'production';

// Environment variable overrides
const config = {
  disableHotReload: isProduction || process.env.DISABLE_HOT_RELOAD === "true",
  enableVisualEdits: !isProduction && process.env.REACT_APP_ENABLE_VISUAL_EDITS === "true",
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load visual editing modules only if enabled
let babelMetadataPlugin;
let setupDevServer;

if (config.enableVisualEdits) {
  babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
  setupDevServer = require("./plugins/visual-edits/dev-server-setup");
}

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

const webpackConfig = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig, { env }) => {
      
      // In production, remove all hot reload and react-refresh related plugins
      if (env === 'production' || config.disableHotReload) {
        webpackConfig.plugins = webpackConfig.plugins.filter(plugin => {
          const pluginName = plugin.constructor.name;
          return !(
            pluginName === 'HotModuleReplacementPlugin' ||
            pluginName === 'ReactRefreshPlugin'
          );
        });

        // Remove react-refresh from babel
        if (webpackConfig.module && webpackConfig.module.rules) {
          webpackConfig.module.rules = webpackConfig.module.rules.map(rule => {
            if (rule.oneOf) {
              rule.oneOf = rule.oneOf.map(oneOfRule => {
                if (oneOfRule.use) {
                  oneOfRule.use = oneOfRule.use.map(use => {
                    if (use.loader && use.loader.includes('babel-loader') && use.options && use.options.plugins) {
                      use.options.plugins = use.options.plugins.filter(plugin => {
                        if (Array.isArray(plugin)) {
                          return !plugin[0].includes('react-refresh');
                        }
                        return typeof plugin !== 'string' || !plugin.includes('react-refresh');
                      });
                    }
                    return use;
                  });
                }
                return oneOfRule;
              });
            }
            return rule;
          });
        }

        // Disable watch mode
        webpackConfig.watch = false;
        webpackConfig.watchOptions = {
          ignored: /.*/,
        };
      } else {
        // Development mode - add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
          ],
        };
      }

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      return webpackConfig;
    },
  },
};

// Only add babel plugin if visual editing is enabled (never in production)
if (config.enableVisualEdits && !isProduction) {
  webpackConfig.babel = {
    plugins: [babelMetadataPlugin],
  };
}

// Setup dev server with visual edits and/or health check (only in development)
if (!isProduction && (config.enableVisualEdits || config.enableHealthCheck)) {
  webpackConfig.devServer = (devServerConfig) => {
    // Apply visual edits dev server setup if enabled
    if (config.enableVisualEdits && setupDevServer) {
      devServerConfig = setupDevServer(devServerConfig);
    }

    // Add health check endpoints if enabled
    if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
      const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

      devServerConfig.setupMiddlewares = (middlewares, devServer) => {
        // Call original setup if exists
        if (originalSetupMiddlewares) {
          middlewares = originalSetupMiddlewares(middlewares, devServer);
        }

        // Setup health endpoints
        setupHealthEndpoints(devServer, healthPluginInstance);

        return middlewares;
      };
    }

    return devServerConfig;
  };
}

module.exports = webpackConfig;
