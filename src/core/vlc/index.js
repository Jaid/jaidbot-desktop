import got from "got"
import fastDecodeUriComponent from "fast-decode-uri-component"
import urlParse from "url-parse"
import fsp from "@absolunet/fsp"
import preventStart from "prevent-start"
import socket from "core:src/socket"
import logger from "core:lib/logger"
import config from "core:lib/config"

const gotOptions = {
  baseUrl: "http://" + config.vlc.host + "/requests",
  auth: ":" + config.vlc.password,
  throwHttpErrors: false,
  retry: {
    retries: 3,
    errorCodes: ["ETIMEDOUT", " ECONNRESET", "EADDRINUSE", "EPIPE", "ENOTFOUND", "ENETUNREACH", "EAI_AGAIN"],
  },
  json: true,
  port: config.vlc.port,
}

class Vlc {

  init() {
    socket.on("getVlcState", async callback => {
      const state = await this.getState()
      callback(state)
    })
    logger.info("VLC is initialized")
  }

  async getState() {
    try {
      const {body} = await got("status.json", gotOptions)
      return body
    } catch {
      return null
    }
  }

  async getPlaylist() {
    try {
      const {body: playlist} = await got("playlist.json", gotOptions)
      return playlist.children.find(({name}) => name === "Playlist")
    } catch {
      return null
    }
  }

  async getCurrentVideo() {
    const state = await this.getState()
    const playlist = await this.getPlaylist()
    if (!state || !playlist) {
      return null
    }
    const playlistEntry = playlist.children.find(({id}) => Number(id) === state.currentplid)
    if (!playlistEntry) {
      return null
    }
    return playlistEntry
  }

  async getCurrentVideoPath() {
    const playlistEntry = await this.getCurrentVideo()
    if (!playlistEntry) {
      return null
    }
    const videoFile = playlistEntry.uri
    |> preventStart(#, "file:///")
    |> fastDecodeUriComponent
    const videoFileExists = await fsp.pathExists(videoFile)
    if (!videoFileExists) {
      return null
    }
    return videoFile
  }

  async getMetaForVideo(videoFile) {
    if (!videoFile) {
      videoFile = await this.getCurrentVideoPath()
      if (!videoFile) {
        return null
      }
    }
    const metaFile = videoFile.replace(/\.(mp4|webm|mov|flv|mkv)$/i, ".info.json")
    const metaFileExists = await fsp.pathExists(metaFile)
    if (!metaFileExists) {
      return null
    }
    const info = await fsp.readJson(metaFile)
    return info
  }

  async sendCommand(command, query) {
    try {
      await got("status.json", {
        ...gotOptions,
        query: {
          command,
          ...query,
        },
      })
      return true
    } catch {
      return null
    }
  }

}

export default new Vlc