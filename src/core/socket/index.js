import socketIoClient from "socket.io-client"
import config from "core:lib/config"

const socketClient = socketIoClient(`${config.server.protocol}://${config.server.host}:${config.server.port}`, {
  query: {
    password: config.server.password,
  },
})

export default socketClient