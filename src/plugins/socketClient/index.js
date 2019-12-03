import ms from "ms.macro"
import socketIoClient from "socket.io-client"

import {logger} from "src/core"

class SocketClient {

  handleConfig(config) {
    this.url = config.botServerUrl
    this.password = config.botPassword
  }

  init() {
    this.socket = socketIoClient(this.url, {
      rejectUnauthorized: false,
      query: {
        password: this.password,
      },
    })

    this.socket.on("connect_error", error => {
      logger.warn("Connection failed to %s: %s", this.url, error)
    })

    this.socket.on("error", error => {
      logger.warn("Error on websocket connection to %s: %s", this.url, error)
    })

    this.socket.on("connect", () => {
      logger.info("Connected to %s", this.url)
    })

    this.socket.on("disconnect", () => {
      logger.info("Disconnected from %s", this.url)
    })

    setTimeout(() => {
      if (!this.socket.connected) {
        logger.warn("Did not connect to socket server %s", this.url)
        process.exit(1)
      }
    }, ms`5 seconds`)
  }

}

export default new SocketClient