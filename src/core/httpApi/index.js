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
        response.send("EMPTY")
      }
    })
    this.app.listen(31310)
    logger.info("HTTP API listens to %s", 31310)
  }

}

export default new HttpApi