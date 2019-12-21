import socketIo from "socket.io"

import socketEnhancer from "lib/socketEnhancer"

import {logger} from "src/core"

class SocketClient {

  setCoreReference(core) {
    this.core = core
  }

  init() {
    this.socketServer = socketIo(this.core.insecureServer)
    this.socketServer.on("connection", client => {
      logger.info("%s connected", client.id)
    })
    socketEnhancer.enhanceServer(this.socketServer)
  }

  postInit() {
    this.socket = this.core.plugins.socketClient.socket
  }

  ready() {
    this.socket.on("updateChatters", chatters => {
      this.socketServer.emit("updateChatters", chatters)
    })
    this.socket.on("forwardToOverlay", (eventName, payload) => {
      this.socketServer.emit(eventName, payload)
    })
  }

}

export default new SocketClient