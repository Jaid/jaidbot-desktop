import EventEmitter from "events"

import ChatClient from "twitch-chat-client"
import twitch from "twitch"
import {log} from "lib/logger"
import config from "lib/config"
import moment from "lib/moment"

import ChatBot from "./ChatBot"

const streamerScopes = [
  "user:edit:broadcast",
  "user:edit",
  "channel:read:subscriptions",
  "user:read:broadcast",
  "channel_editor",
  "channel_read",
]

class TwitchCore extends EventEmitter {

  async init() {
    const [botClient, streamerClient] = await Promise.all([
      twitch.withCredentials(config.twitchBotClient.id, config.twitchBotClient.token),
      twitch.withCredentials(config.twitchApiClient.id, config.twitchApiClient.token, streamerScopes),
    ])
    this.broadcaster = await streamerClient.helix.users.getMe()
    log("Initialized Twitch clients")
    const chatClient = await ChatClient.forTwitchClient(botClient)
    await chatClient.connect()
    await chatClient.waitForRegistration()
    await chatClient.join(this.broadcaster.name)
    log("Connected bot")
    this.botClient = botClient
    this.streamerClient = streamerClient
    this.chatClient = chatClient
    this.chatBot = new ChatBot()
    chatClient.onPrivmsg((channel, user, message, msg) => {
      const messageInfo = {
        text: message,
        sender: {
          id: msg.userInfo.userId,
          name: msg.userInfo.userName,
          isBroadcaster: msg.userInfo.badges.get("broadcaster") === "1",
          isVip: msg.userInfo.badges.get("vip") === "1",
          isMod: msg.userInfo.isMod,
          isSub: msg.userInfo.isSubscriber,
        },
      }
      messageInfo.sender.displayName = msg.userInfo.displayName || messageInfo.sender.name
      messageInfo.sender.hasElevatedPermission = Boolean(msg.userInfo.userType) || messageInfo.sender.isBroadcaster
      this.handleChatMessage(messageInfo)
    })
  }

  handleChatMessage(message) {
    log(`${message.sender.displayName}: ${message.text}`)
    this.emit("chat", message)
    this.chatBot.handleMessage(message)
  }

  async userNameToDisplayName(userName) {
    const profile = await this.streamerClient.helix.users.getUserByName(userName)
    return profile?.displayName || profile?.name || userName
  }

  async getFollowMoment(userName) {
    const user = await this.streamerClient.helix.users.getUserByName(userName)
    const followResult = await user.getFollowTo(this.broadcaster)
    if (followResult === null) {
      return false
    }
    return moment(followResult.followDate)
  }

  async getMyStream() {
    return this.streamerClient.kraken.streams.getStreamByChannel(this.broadcaster.id)
  }

  async setCategory(game) {
    await this.streamerClient.kraken.channels.updateChannel(this.broadcaster, {game})
  }

  async setTitle(title) {
    await this.streamerClient.kraken.channels.updateChannel(this.broadcaster, {
      status: title.trim(),
    })
  }

  say(message) {
    this.chatClient.say(this.broadcaster.name, message)
  }

}

export default new TwitchCore