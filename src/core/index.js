import config from "core:lib/config"
import logger from "core:lib/logger"
import socket from "core:src/socket"
import vlc from "core:src/vlc"
import httpApi from "core:src/httpApi"
import {interval} from "interval-promise"
import ms from "ms.macro"

logger.info(`${_PKG_TITLE} v${_PKG_VERSION}`)

const job = async () => {
  vlc.init()
  await httpApi.init()
  interval(async () => {
    await vlc.sendStatusToServer()
  }, ms`5 seconds`)
}

job()