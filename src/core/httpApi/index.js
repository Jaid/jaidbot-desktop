import express from "express"
import logger from "core:lib/logger"
import config from "core:lib/config"
import socketClient from "core:src/socket"
import emitPromise from "emit-promise"
import vlc from "core:src/vlc"

class HttpApi {

  async init() {
    this.app = express()
    this.app.get("/play", async (request, response) => {
      logger.info("PLAY")
      const nextVideo = await emitPromise(socketClient, "getNextVideo")
      if (nextVideo) {
        await vlc.queueFile(nextVideo.videoFile)
        response.send(`OK, ${nextVideo.videoFile}`)
      } else {
        logger.warn("Got no next video from server playlist")
        response.send("EMPTY")
      }
    })
    this.app.listen(config.httpApiPort)
    logger.info("HTTP API listens to %s", config.httpApiPort)
  }

}

export default new HttpApi