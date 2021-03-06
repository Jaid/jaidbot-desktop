import fsp from "@absolunet/fsp"
import execa from "execa"
import fastDecodeUriComponent from "fast-decode-uri-component"
import filenamify from "filenamify-shrink"
import filesize from "filesize"
import findByExtension from "find-by-extension"
import {last, sortBy} from "lodash"
import ms from "ms.macro"
import path from "path"
import preventStart from "prevent-start"
import sortKeys from "sort-keys"

import {logger} from "src/core"

const filenamifyExtreme = string => {
  return string.replace(/([#$%&.])/g, "") |> filenamify
}

class Vlc {

  setCoreReference(core) {
    this.core = core
  }

  handleConfig(config) {
    this.host = config.vlcApiHost
    this.user = config.vlcApiUser
    this.password = config.vlcApiPassword
    this.port = config.vlcApiPort
    this.youtubeDlPath = config.youtubeDlPath
    this.youtubeDlCookieFile = config.youtubeDlCookieFile
    this.downloadFolder = config.videoDownloadFolder
  }

  init() {
    this.socket = this.core.plugins.socketClient.socket
    /**
     * @type {import("got").Got}
     */
    this.got = this.core.got.extend({
      prefixUrl: `http://${this.host}/requests`,
      username: this.user,
      password: this.password,
      responseType: "json",
      port: this.port,
    })

    this.socket.on("getVlcState", async callback => {
      try {
        const vlcState = await this.getState()
        if (!vlcState) {
          callback("noVlc")
          return
        }
        callback(vlcState)
        return
      } catch (error) {
        logger.error("Error in getVlcState handler: %s", error)
        callback(false)
        return
      }
    })
    this.socket.on("getVlcVideo", async callback => {
      try {
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
        return
      } catch (error) {
        logger.error("Error in getVlcVideo handler: %s", error)
        callback(false)
        return
      }
    })
    this.socket.on("sendVlcCommand", async (command, callback) => {
      try {
        const result = await this.sendCommand(command)
        callback(result)
        return
      } catch (error) {
        logger.error("Error in sendVlcCommand handler: %s", error)
        callback(false)
        return
      }
    })
    this.socket.on("queueInfo", async ({videoId, videoInfo, downloadFormat}) => {
      try {
        videoInfo.videoId = videoId
        videoInfo.downloadFormat = downloadFormat
        await this.download(videoInfo)
      } catch (error) {
        logger.error("Error in queueInfo handler: %s", error)
      }
    })
    this.socket.on("fetchVideoInfo", async (url, callback) => {
      try {
        const execResult = await execa(this.youtubeDlPath, [
          "--no-color",
          "--ignore-config",
          "--netrc",
          "--cookies",
          this.youtubeDlCookieFile,
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
    this.socket.on("playVideo", (payload, callback) => this.handlePlayVideo(payload, callback))
    logger.info("VLC is initialized")
  }

  async handlePlayVideo({videoFile, timestamp}, callback) {
    try {
      await this.got(`playlist.json?command=in_play&input=file:///${videoFile}`)
      logger.info("Playing %s", videoFile)
      const timestampMinus10 = timestamp - ms`10 seconds`
      if (timestampMinus10 > 0) {
        const timestampSeconds = Math.floor(timestampMinus10 / 1000)
        logger.info("Skipping to second %s", timestampSeconds)
        await this.sendCommand({
          command: "seek",
          val: `${timestampSeconds}s`,
        })
      }
      callback(true)
      return
    } catch (error) {
      logger.error("Error in handlePlayVideo: %s", error)
      callback(false)
      return
    }
  }

  getPathsFromVideoInfo(videoInfo) {
    const safeTitle = videoInfo.title |> filenamifyExtreme
    const downloadFolder = path.join(this.downloadFolder, String(videoInfo.videoId))
    const downloadFile = path.join(downloadFolder, videoInfo.height ? `${videoInfo.height}p` : "video")
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
        this.socket.emit("setInfoFile", {
          infoFile,
          videoId: videoInfo.videoId,
        })
      }
      const execResult = await execa(this.youtubeDlPath, [
        "--no-color",
        "--ignore-config",
        "--abort-on-error",
        "--netrc",
        "--format",
        videoInfo.downloadFormat,
        "--cookies",
        this.youtubeDlCookieFile,
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
      if (!actualDownloadFile) {
        throw new Error(`Could not find download file in ${downloadFolder}`)
      }
      const stat = await fsp.stat(actualDownloadFile)
      const bytes = stat.size
      logger.info("Downloaded %s to %s", bytes |> filesize, actualDownloadFile)
      this.socket.emit("videoDownloaded", {
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
      const result = await this.got("status.json")
      return result.body
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

  async sendCommand(searchParams) {
    try {
      await this.got("status.json", {
        searchParams,
        method: "POST",
      })
      return true
    } catch {
      return null
    }
  }

  async sendStatusToServer() {
    try {
      if (!this.socket.connected) {
        return
      }
      const status = await this.getState()
      if (!status?.length) {
        return
      }
      let durationSeconds
      const durationValue = status.information?.category?.meta?.DURATION
      if (durationValue) {
        const durationParsed = /(?<hours>\d+):(?<minutes>\d+):(?<seconds>[\d.]+)/.exec(durationValue)?.groups
        if (!durationParsed) {
          logger.warn("Couldn't parse duration value %s", durationValue)
        } else {
          durationSeconds = Number(durationParsed.seconds) + durationParsed.minutes * 60 + durationParsed.hours * 3600
        }
      }
      if (!durationSeconds) {
        durationSeconds = status.length
      }
      const durationMs = Math.floor(durationSeconds * 1000)
      this.socket.emit("vlcState", {
        durationMs,
        position: status.position,
        state: status.state,
        timestampMs: Math.floor(durationMs * status.position),
        file: status.information.category.meta.filename,
      })
    } catch (error) {
      logger.error("Could not send VLC heartbeat: %s", error)
    }
  }

}

export default new Vlc