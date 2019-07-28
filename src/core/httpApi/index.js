import express from "express"
import logger from "core:lib/logger"
import config from "core:lib/config"
import socket from "core:src/socket"
import emitPromise from "emit-promise"
import vlc from "core:src/vlc"

class HttpApi {

  async init() {
    this.app = express()
    this.app.get("/play", async (request, response) => {
      try {
        logger.info("PLAY")
        const nextVideo = await emitPromise.withDefaultTimeout(socket, "getNextVideo")
        if (nextVideo) {
          logger.info("Next video: %s", nextVideo.videoFile)
          await vlc.queueFile(nextVideo.videoFile)
          response.send(`OK, ${nextVideo.videoFile}`)
        } else {
          logger.warn("Got no next video from server playlist")
          response.send("EMPTY")
        }
      } catch (error) {
        logger.error("Could not handle /play: %s", error)
      }
    })
    this.app.listen(config.httpApiPort)
    logger.info("HTTP API listens to %s", config.httpApiPort)
  }

}

export default new HttpApi