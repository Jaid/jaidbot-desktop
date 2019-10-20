import {logger} from "src/core"
import intervalPromise from "interval-promise"
import ms from "ms.macro"
import emitPromise from "emit-promise"
import hasContent from "has-content"
import plural from "pluralize-inclusive"
import Queue from "p-queue"
import zahl from "zahl"

export default class Main {

  setCoreReference(core) {
    this.core = core
    this.vlc = core.plugins.vlc
  }

  /**
   * @param {import("jaid-core").default} core
   */
  async ready() {
    this.socket = this.core.plugins.socketClient.socket
    this.downloadQueue = new Queue({concurrency: 3})
    this.socket.on("connect", async () => {
      if (this.downloadQueue.size > 0) {
        logger.debug("Download queue has %s, will not be asking for new downloads", zahl(this.downloadQueue, "job"))
        return
      }
      const videosToDownload = await emitPromise.withDefaultTimeout(this.socket, "getDownloadJobs")
      if (videosToDownload |> hasContent) {
        logger.info("%s to download", plural("video", videosToDownload.length))
        for (const {id, downloadFormat, info} of videosToDownload) {
          const job = async () => {
            logger.info("Starting download of video #%s", id)
            info.videoId = id
            info.downloadFormat = downloadFormat
            await this.vlc.download(info)
          }
          await this.downloadQueue.add(job)
        }
      }
    })
    intervalPromise(() => this.vlc.sendStatusToServer(), ms`5 seconds`)
  }

}