import socketIoClient from "socket.io-client"
import {config, logger} from "src/core"
import ms from "ms.macro"

const socket = socketIoClient(config.botServerUrl, {
  rejectUnauthorized: false,
  query: {
    password: config.botPassword,
  },
})

socket.on("connect_error", error => {
  logger.warn("Connection failed to %s: %s", config.botServerUrl, error)
})

socket.on("error", error => {
  logger.warn("Error on websocket connection to %s: %s", config.botServerUrl, error)
})

socket.on("connect", () => {
  logger.info("Connected to %s", config.botServerUrl)
})

socket.on("disconnect", () => {
  logger.info("Disconnected from %s", config.botServerUrl)
})

setTimeout(() => {
  if (!socket.connected) {
    logger.warn("Did not connect to socket server %s", config.botServerUrl)
    process.exit(1)
  }
}, ms`5 seconds`)

export default socket