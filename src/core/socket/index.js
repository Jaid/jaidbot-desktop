import socketIoClient from "socket.io-client"
import config from "core:lib/config"
import logger from "core:lib/logger"

const socket = socketIoClient(`${config.server.protocol}://${config.server.host}:${config.server.port}`, {
  query: {
    password: config.server.password,
  },
})

socket.on("connect", () => {
  logger.info("Connected to %s", config.server.host)
})

socket.on("disconnect", () => {
  logger.info("Disconnected from %s", config.server.host)
})

export default socket