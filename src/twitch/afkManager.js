import EventEmitter from "events"

import moment from "lib/moment"
import humanizeDuration from "lib/humanizeDuration"
import twitch from "src/twitch"
import logger from "lib/logger"

const extractTitleRegex = /(?<nontitle>(?<prefix>.*?)?\s*(?<emoji>💜)\s*)?(?<title>.*)/

const afkToleranceMinutes = 2

class AfkManager extends EventEmitter {

  afkMessage = null

  afkStart = null

  afkEnd = null

  title = null

  constructor() {
    super()
    setInterval(() => {
      if (this.isAfk()) {
        this.setTitle()
      }
    }, 30000)
    this.setTitle()
  }

  isAfk() {
    return this.afkMessage !== null
  }

  getRemainingTime() {
    return this.afkEnd - Date.now()
  }

  getRemainingTimeString() {
    const remainingTimeMs = this.getRemainingTime()
    if (remainingTimeMs <= 60 * 1000) {
      return ""
    }
    const remainingTimeString = moment.duration(remainingTimeMs, "ms").format("h[h] m[m]")
    return `, ${remainingTimeString}`
  }

  getTitlePrefix() {
    if (!this.isAfk()) {
      return ""
    }
    return `[${this.afkMessage}${this.getRemainingTimeString()}] `
  }

  async setTitle(title) {
    if (!twitch) {
      return
    }
    if (title) {
      this.title = title
    }
    if (!this.title) {
      const {channel} = await twitch.getMyStream()
      this.title = extractTitleRegex.exec(channel.status).groups.title
    }
    await twitch.setTitle(`${this.getTitlePrefix()}💜 ${this.title}`)
  }

  async activate(durationSeconds, message) {
    this.afkStart = Date.now()
    this.afkEnd = this.afkStart + durationSeconds * 1000
    this.afkMessage = message
    await this.setTitle()
    twitch.say(`Jaidchen geht jetzt mal weg für etwa ${(durationSeconds * 1000) |> humanizeDuration}. Als Nachricht hat er lediglich ein "${message}" hinterlassen.`)
  }

  async deactivate() {
    const remainingTime = this.getRemainingTime()
    const getComment = () => {
      if (remainingTime > (afkToleranceMinutes * 60 * 1000)) {
        return `Oh, der ist ja schon wieder da, ${remainingTime |> humanizeDuration} früher als angekündigt! KomodoHype`
      } else if (remainingTime > (-afkToleranceMinutes * 60 * 1000)) {
        return "Da ist er ja wieder! TPFufun"
      } else {
        return `"${this.afkMessage}", ja ja. Du wolltest doch eigentlich schon seit ${remainingTime |> Math.abs |> humanizeDuration} wieder da sein. Jaidchen, wo bist du gewesen? HotPokket`
      }
    }
    const comment = getComment()
    this.afkStart = null
    this.afkEnd = null
    this.afkMessage = null
    await this.setTitle()
    twitch.say(comment)
  }

}

export default new AfkManager