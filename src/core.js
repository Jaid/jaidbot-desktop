import EventEmitter from "events"

import twitch from "src/twitch"
import logger from "lib/logger"

class Core extends EventEmitter {

  async init() {
    logger.info(`${_PKG_TITLE} v${_PKG_VERSION}`)
    await Promise.all([twitch.init()])
    twitch.say("TBAngel Da bin ich!")
    logger.info("Ready!")
    this.emit("ready")
  }

}

export default new Core