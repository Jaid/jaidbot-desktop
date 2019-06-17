import path from "path"

import got from "got"
import fastDecodeUriComponent from "fast-decode-uri-component"
import fsp from "@absolunet/fsp"
import preventStart from "prevent-start"
import socket from "core:src/socket"
import logger from "core:lib/logger"
import config from "core:lib/config"
import execa from "execa"
import filenamify from "core:lib/filenamify"

const gotOptions = {
  baseUrl: `http://${config.vlc.host}/requests`,
  auth: `:${config.vlc.password}`,
  throwHttpErrors: false,
  retry: {
    retries: 3,
    errorCodes: ["ETIMEDOUT", " ECONNRESET", "EADDRINUSE", "EPIPE", "ENOTFOUND", "ENETUNREACH", "EAI_AGAIN"],
  },
  json: true,
  port: config.vlc.port,
  hooks: {
    beforeRequest: [
      request => {
        logger.debug("Requested VLC API: %s", request.href)
      },
    ],
  },
}

class Vlc {

  init() {
    socket.on("getVlcState", async callback => {
      const vlcState = await this.getState()
      if (!vlcState) {
        callback("noVlc")
        return
      }
      callback(vlcState)
    })
    socket.on("getVlcVideo", async callback => {
      const vlcState = await this.getState()
      if (!vlcState) {
        callback("noVlc")
        return
      }
      if (vlcState.currentplid < 0) {
        callback("noVideo")
        return
      }
      const videoFile = await this.getCurrentVideoPath()
      if (!videoFile) {
        callback("videoNotOnDisk")
        return
      }
      const videoInfo = await this.getMetaForVideo(videoFile)
      if (!videoInfo) {
        callback("noInfoFound")
        return
      }
      const {size: videoSize} = await fsp.stat(videoFile)
      callback({
        videoInfo,
        videoFile,
        videoSize,
        vlcState,
      })
    })
    socket.on("sendVlcCommand", async (command, callback) => {
      const result = await this.sendCommand(command)
      callback(result)
    })
    socket.on("queueInfo", async ({videoInfo, downloadFormat}, callback) => {
      try {
        const downloadFolder = path.join(config.youtubeDl.downloadFolder, videoInfo.extractor |> filenamify, videoInfo.uploader |> filenamify)
        const safeTitle = videoInfo.title |> filenamify
        const infoFile = path.join(downloadFolder, `${safeTitle}.json`)
        const downloadFile = path.join(downloadFolder, `${safeTitle |> filenamify}.${videoInfo.ext}`)
        await fsp.outputJson(infoFile, videoInfo)
        await execa(config.youtubeDl.path, [
          "--no-color",
          "--ignore-config",
          "--abort-on-error",
          "--netrc",
          "--format",
          downloadFormat,
          "--cookies",
          config.youtubeDl.cookieFile,
          "--mark-watched",
          "audio-quality",
          1,
          "--load-info-json",
          infoFile,
          "--output",
          downloadFile,
        ])
        execa(config.vlc.path, ["--one-instance", "--playlist-enqueue", downloadFile], {
          detached: true,
          cleanup: false,
        })
        logger.info("VLC is initialized")
        callback({
          infoFile,
          downloadFile,
        })
        return
      } catch (error) {
        logger.error("queueInfo: %s", error)
        callback(false)
      }
    })
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
    const videoFile = preventStart(playlistEntry.uri, "file:///") |> fastDecodeUriComponent
    const videoFileExists = await fsp.pathExists(videoFile)
    if (!videoFileExists) {
      return null
    }
    return videoFile
  }

  async getMetaForVideo(videoFile) {
    try {
      if (!videoFile) {
        videoFile = await this.getCurrentVideoPath()
        if (!videoFile) {
          return null
        }
      }
      const metaFile = videoFile.replace(/\.[\da-z]+$/i, ".json")
      const metaFileExists = await fsp.pathExists(metaFile)
      if (!metaFileExists) {
        return null
      }
      const info = await fsp.readJson(metaFile)
      return info
    } catch (error) {
      logger.warn(error)
    }
  }

  async sendCommand(query) {
    try {
      await got("status.json", {
        ...gotOptions,
        query,
      })
      return true
    } catch {
      return null
    }
  }

}

export default new Vlc