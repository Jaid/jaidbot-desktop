import path from "path"

import configure, {configureWebapp} from "webpack-config-jaid"

// const dashboardConfig = configureWebapp({
//   sourceFolder: "src/dashboard",
//   title: "Jaidbot Dashboard",
//   inlineSource: true,
//   outDir: path.join(__dirname, "dist", "package-dashboard", process.env.NODE_ENV || "development"),
//   publishimo: {
//     fetchGithub: true,
//   },
// })

// const overlayConfig = configureWebapp({
//   sourceFolder: "src/overlay",
//   title: "Jaidbot Overlay",
//   inlineSource: true,
//   outDir: path.join(__dirname, "dist", "package-overlay", process.env.NODE_ENV || "development"),
//   publishimo: {
//     fetchGithub: true,
//   },
// })

const coreConfig = configure({
  type: "cli",
  sourceFolder: "src/core",
  publishimo: {
    fetchGithub: true,
  },
})

module.exports = [coreConfig]