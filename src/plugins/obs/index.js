import {logger} from "src/core"
import ObsWebsocket from "obs-websocket-js"
import {isEmpty} from "has-content"
import filterNil from "filter-nil"

class Obs {

  obs = new ObsWebsocket

  setCoreReference(core) {
    this.core = core
  }

  handleConfig(config) {
    if (config.obsPort |> isEmpty) {
      return false
    }
    this.port = config.obsPort
    if (config.obsPassword |> isEmpty) {
      return false
    }
    this.password = String(config.obsPassword)
  }

  async init() {
    await this.obs.connect({
      address: `localhost:${this.port}`,
      password: this.password,
    })
  }

  postInit() {
    this.socket = this.core.plugins.socketClient.socket
  }

  ready() {
    this.socket.on("showObsSource", async (sourceName, callback) => {
      try {
        const affectedScenes = await this.showSource(sourceName)
        callback(affectedScenes)
        return
      } catch (error) {
        callback(false)
        return
      }
    })

    this.socket.on("hideObsSource", async (sourceName, callback) => {
      try {
        const affectedScenes = await this.hideSource(sourceName)
        callback(affectedScenes)
        return
      } catch (error) {
        callback(false)
        return
      }
    })
  }

  /**
   * @param {string} itemName
   * @return {{foundSource: import("obs-websocket-js").SceneItem, scene: import("obs-websocket-js").Scene}[]}
   */
  async getScenesWithSource(itemName) {
    const itemNameNormalized = String(itemName).replace(/\s+/g, "").toLowerCase()
    const {scenes} = await this.obs.send("GetSceneList")
    const foundScenes = scenes.map(scene => {
      if (scene.sources |> isEmpty) {
        return null
      }
      const foundSource = scene.sources.find(source => {
        const sourceNameNormalized = source.name.replace(/\s+/g, "").toLowerCase()
        return sourceNameNormalized === itemNameNormalized
      })
      if (!foundSource) {
        return null
      }
      return {
        scene,
        foundSource,
      }
    })
    return filterNil(foundScenes)
  }

  /**
   * @param {string} itemName
   * @return {number} Number of modified scenes
   */
  async hideSource(itemName) {
    logger.info(`Hiding source ${itemName}`)
    const scenesWithSource = await this.getScenesWithSource(itemName)
    const relevantScenes = scenesWithSource.filter(({foundSource}) => foundSource.render)
    for (const {scene, foundSource} of relevantScenes) {
      await this.obs.send("SetSceneItemProperties", {
        "scene-name": scene.name,
        item: foundSource.name,
        visible: false,
      })
    }
    return relevantScenes.length
  }

  /**
   * @param {string} itemName
   * @return {number} Number of modified scenes
   */
  async showSource(itemName) {
    logger.info(`Showing source ${itemName}`)
    const scenesWithSource = await this.getScenesWithSource(itemName)
    const relevantScenes = scenesWithSource.filter(({foundSource}) => !foundSource.render)
    for (const {scene, foundSource} of relevantScenes) {
      await this.obs.send("SetSceneItemProperties", {
        "scene-name": scene.name,
        item: foundSource.name,
        visible: true,
      })
    }
    return relevantScenes.length
  }

}

export default new Obs