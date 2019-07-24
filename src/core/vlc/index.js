import path from "path"

import got from "got"
import fastDecodeUriComponent from "fast-decode-uri-component"
import fsp from "@absolunet/fsp"
import preventStart from "prevent-start"
import socket from "core:src/socket"
import logger from "core:lib/logger"
import config from "core:lib/config"
import execa from "execa"
import findByExtension from "find-by-extension"
import filenamify from "filenamify-shrink"
import filesize from "filesize"
import {sortBy, last} from "lodash"
import sortKeys from "sort-keys"

class Vlc {

  init() {
    this.got = got.extend({
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
    })

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
    socket.on("queueInfo", async ({videoId, videoInfo, downloadFormat}) => {
      videoInfo.videoId = videoId
      videoInfo.downloadFormat = downloadFormat
      await this.download(videoInfo)
    })
    socket.on("fetchVideoInfo", async (url, callback) => {
      try {
        const execResult = await execa(config.youtubeDl.path, [
          "--no-color",
          "--ignore-config",
          "--netrc",
          "--cookies",
          config.youtubeDl.cookieFile,
          "--dump-single-json",
          url,
        ])
        const videoInfo = execResult.stdout |> JSON.parse
        logger.info("Successfully fetched video info for the server")
        callback(videoInfo)
        return
      } catch (error) {
        logger.error("Tried backup method of fetching video info of %s for the server, failed.\n%s", url, error)
        callback(false)
        return
      }
    })
    logger.info("VLC is initialized")
  }

  getPathsFromVideoInfo(videoInfo) {
    const filenamifyExtreme = string => {
      return string.replace(/([#$%&.])/g, "") |> filenamify
    }
    const safeTitle = videoInfo.title |> filenamifyExtreme
    const downloadFolder = path.join(config.youtubeDl.downloadFolder, videoInfo.extractor |> filenamifyExtreme, videoInfo.uploader |> filenamifyExtreme, safeTitle)
    const downloadFile = path.join(downloadFolder, safeTitle)
    const infoFile = path.join(downloadFolder, "info.json")
    return {
      safeTitle,
      downloadFolder,
      downloadFile,
      infoFile,
    }
  }

  async download(videoInfo) {
    try {
      const {infoFile, downloadFile, downloadFolder} = this.getPathsFromVideoInfo(videoInfo)
      logger.debug("Preparing video: %s", videoInfo.title)
      const infoFileExists = await fsp.pathExists(infoFile)
      if (!infoFileExists) {
        await fsp.outputJson(infoFile, videoInfo |> sortKeys)
        socket.emit("setInfoFile", {
          infoFile,
          videoId: videoInfo.videoId,
        })
      }
      const execResult = await execa(config.youtubeDl.path, [
        "--no-color",
        "--ignore-config",
        "--abort-on-error",
        "--netrc",
        "--format",
        videoInfo.downloadFormat,
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
      if (execResult.failed) {
        logger.error("Video download may have failed\nCommand: %s\nCode: %s\nOutput: %s", execResult.command, execResult.exitCode, execResult.all)
      } else {
        logger.info("Executed %s", execResult.command)
      }
      const actualDownloadFile = findByExtension(["webm", "mp4", "mkv", "avi", "flv", "mp3", "flac", "wav", "aac", "3gp"], {
        absolute: true,
        cwd: downloadFolder,
      })
      const stat = await fsp.stat(actualDownloadFile)
      const bytes = stat.size
      logger.info("Downloaded %s to %s", bytes |> filesize, actualDownloadFile)
      socket.emit("videoDownloaded", {
        videoId: videoInfo.videoId,
        bytes,
        infoFile,
        videoFile: actualDownloadFile,
      })
    } catch (error) {
      logger.error("Failed to download #%s \"%s\": %s", videoInfo.videoId, videoInfo.title, error)
    }
  }

  async queueFile(file) {
    await this.got(`playlist.json?command=in_play&input=file:///${file}`)
    logger.info("Playing %s", file)
  }

  async getState() {
    try {
      const {body} = await this.got("status.json")
      return body
    } catch (error) {
      logger.error("Could not get VLC state\n%s", error)
      return null
    }
  }

  async getPlaylist() {
    try {
      const {body: playlist} = await this.got("playlist.json")
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

  async getLastVideo() {
    const state = await this.getState()
    const playlist = await this.getPlaylist()
    if (!state || !playlist) {
      return null
    }
    const playlistEntry = sortBy(playlist.children, "id") |> last
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
      const videoFolder = path.dirname(videoFile)
      const metaFile = path.join(videoFolder, "info.json")
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
      await this.got("status.json", {query})
      return true
    } catch {
      return null
    }
  }

  async sendStatusToServer() {
    const status = await this.getState()
    if (!status?.information) {
      return
    }
    const durationValue = status.information.category.meta.DURATION
    const durationParsed = /(?<hours>\d+):(?<minutes>\d+):(?<seconds>[\d.]+)/.exec(durationValue).groups
    const durationSeconds = Number(durationParsed.seconds) + durationParsed.minutes * 60 + durationParsed.hours * 3600
    const durationMs = Math.floor(durationSeconds * 1000)
    socket.emit("vlcState", {
      durationMs,
      position: status.position,
      state: status.state,
      timestampMs: Math.floor(durationMs * status.position),
      file: status.information.category.meta.filename,
    })
  }

}

export default new Vlc