import essentialConfig from "essential-config"
import logger from "lib/logger"

import defaultConfig from "./defaults.yml"

const config = essentialConfig(_PKG_TITLE, defaultConfig)

if (!config) {
  logger.warn("Set up default config, please edit and restart")
  process.exit(2)
}

export default config