import {logger} from "src/core"
import Obs from "obs-websocket-js"
import {isEmpty} from "has-content"

class Vlc {

  obs = new Obs

  setCoreReference(core) {
    this.core = core
  }

  handleConfig(config) {
    this.port = config.obsPort
    this.password = config.obsPassword
  }

  async init() {
    if (this.port |> isEmpty) {
      return false
    }
    if (this.password |> isEmpty) {
      return false
    }
    await this.obs.connect({
      address: `localhost:${this.port}`,
      password: this.password,
    })
  }

  async hideSource(name) {
    const scenes = await this.obs.send("GetSceneList")
    debugger
  }

}

export default new Vlc