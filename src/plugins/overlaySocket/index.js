import core, {logger} from "src/core"
import socketIo from "socket.io"
import socketEnhancer from "lib/socketEnhancer"

class SocketClient {

  init() {
    this.socketServer = socketIo(core.insecureServer)
    this.socketServer.on("connection", client => {
      logger.info("%s connected", client.id)
    })
    socketEnhancer.enhanceServer(this.socketServer)
  }

}

export default new SocketClient