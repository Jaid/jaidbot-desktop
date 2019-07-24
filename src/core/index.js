import logger from "core:lib/logger"
import vlc from "core:src/vlc"
import httpApi from "core:src/httpApi"
import intervalPromise from "interval-promise"
import ms from "ms.macro"

logger.info(`${_PKG_TITLE} v${_PKG_VERSION}`)

const job = async () => {
  vlc.init()
  await httpApi.init()
  intervalPromise(() => vlc.sendStatusToServer(), ms`5 seconds`)
}

job()