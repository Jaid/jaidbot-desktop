import config from "core:lib/config"
import logger from "core:lib/logger"
import socket from "core:src/socket"
import vlc from "core:src/vlc"

logger.info(`${_PKG_TITLE} v${_PKG_VERSION}`)

vlc.init()