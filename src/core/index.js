import logger from "core:lib/logger"
import vlc from "core:src/vlc"
import httpApi from "core:src/httpApi"
import intervalPromise from "interval-promise"
import ms from "ms.macro"
import socket from "core:src/socket"
import {emitTimeout} from "emit-promise"
import hasContent from "has-content"

logger.info(`${_PKG_TITLE} v${_PKG_VERSION}`)

const job = async () => {
  try {
    vlc.init()
    await httpApi.init()
    socket.on("connect", async () => {
      const videosToDownload = await emitTimeout(socket, ms`10 seconds`, "getDownloadJobs")
      if (videosToDownload |> hasContent) {
        logger.info("%s videos to download", videosToDownload.length)
        const jobs = videosToDownload.map(async ({id, downloadFormat, info}) => {
          info.videoId = id
          info.downloadFormat = downloadFormat
          await vlc.download(info)
        })
        await Promise.all(jobs)
      }
    })
    intervalPromise(() => vlc.sendStatusToServer(), ms`5 seconds`)
  } catch (error) {
    logger.error("Could not initialize: %s", error)
    process.exit(1)
  }
}

job()