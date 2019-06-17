import essentialConfig from "essential-config"
import logger from "core:lib/logger"

import defaults from "./defaults.yml"

const {config} = essentialConfig(_PKG_TITLE, {
  defaults,
  sensitiveKeys: ["server"],
})

if (!config) {
  logger.warn("Set up default config, please edit and restart")
  process.exit(2)
}

export default config