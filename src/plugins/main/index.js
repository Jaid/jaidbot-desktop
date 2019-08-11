import {logger} from "src/core"
import vlc from "lib/vlc"
import intervalPromise from "interval-promise"
import ms from "ms.macro"
import socket from "lib/socket"
import emitPromise from "emit-promise"
import hasContent from "has-content"
import plural from "pluralize-inclusive"

export default class {

  /**
   * @param {import("jaid-core").default} core
   */
  async ready() {
    vlc.init()
    socket.on("connect", async () => {
      const videosToDownload = await emitPromise.withDefaultTimeout(socket, "getDownloadJobs")
      if (videosToDownload |> hasContent) {
        logger.info("%s to download", plural("video", videosToDownload.length))
        const jobs = videosToDownload.map(async ({id, downloadFormat, info}) => {
          info.videoId = id
          info.downloadFormat = downloadFormat
          await vlc.download(info)
        })
        await Promise.all(jobs)
      }
    })
    intervalPromise(() => vlc.sendStatusToServer(), ms`5 seconds`)
  }

}