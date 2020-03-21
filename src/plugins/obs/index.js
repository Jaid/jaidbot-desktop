import filterNil from "filter-nil"
import {isEmpty} from "has-content"
import ObsWebsocket from "obs-websocket-js"

import {logger} from "src/core"

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

  async ready() {
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

    await this.hideSource("VLC Fullscreen")
  }

  /**
   * @param {string} itemName
   * @return {{foundSource: import("obs-websocket-js").SceneItem, scene: import("obs-websocket-js").Scene}[]}
   */
  async getScenesWithSource(itemName) {
    const itemNameNormalized = String(itemName).replace(/\s+/g, "").toLowerCase()
    const {scenes} = await this.obs.send("GetSceneList")
    const foundScenes = scenes.map(scene => {
      if (isEmpty(scene.sources)) {
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
    logger.debug(`Affected scenes: ${relevantScenes.map(scene => scene.scene.name).join(", ")}`)
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
   * TODO: This is currently bugged
   * SetSceneItemProperties affects one random source that matches "scene-name" and "item"
   * Does not deliver consistent results for scenes where an item (top-level or grouped) exists more than once
   */
  async showSource(itemName) {
    logger.info(`Showing source ${itemName}`)
    const scenesWithSource = await this.getScenesWithSource(itemName)
    const relevantScenes = scenesWithSource.filter(({foundSource}) => !foundSource.render)
    logger.debug(`Affected scenes: ${relevantScenes.map(scene => scene.scene.name).join(", ")}`)
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