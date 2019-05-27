import EventEmitter from "events"

import stringArgv from "string-argv"
import minimist from "minimist"
import {isString} from "lodash"
import twitch from "src/twitch"

const commandRegex = /^(?<prefix>!)(?<commandName>[\da-z]+)(?<afterCommandName>\s*(?<commandArguments>.*))?/i

const commandsRequire = require.context("./commands/", true, /index\.js$/)
const commands = commandsRequire.keys().reduce((state, value) => {
  const commandName = value.match(/\.\/(?<key>[\da-z]+)\//i).groups.key
  state[commandName] = commandsRequire(value).default
  return state
}, {})

export default class ChatBot extends EventEmitter {

  handleMessage(message) {
    const parsedCommand = commandRegex.exec(message.text.trim())
    if (parsedCommand === null) {
      return
    }
    const {commandName} = parsedCommand.groups
    let commandArguments
    let positionalArguments
    if (parsedCommand.groups.commandArguments) {
      commandArguments = parsedCommand.groups.commandArguments |> stringArgv |> minimist
      positionalArguments = commandArguments._
    }
    const command = commands[commandName]
    if (!command) {
      twitch.say(`Verstehe ich jetzt nicht, ${message.sender.displayName}! Alle Befehle sind in den Panels unter dem Stream beschrieben.`)
      return
    }
    if (command.requiredArguments) {
      if (!commandArguments) {
        twitch.say(`${message.sender.displayName}, dieser Befehl kann nicht ohne Arguments verwendet werden!`)
        return
      }
      const givenArgumentsLength = positionalArguments.length
      if (command.requiredArguments > givenArgumentsLength) {
        twitch.say(`${message.sender.displayName}, dieser Befehl benötigt ${command.requiredArguments} Arguments!`)
        return
      }
    }
    if (!message.sender.isBroadcaster) {
      if (command.permission === "sub-or-vip" && !message.sender.isVip && !message.sender.isSub && !message.sender.isMod) {
        twitch.say(`${message.sender.displayName}, für diesen Befehl musst du Moderator, Subscriber oder VIP sein!`)
        return
      }
      if (command.permission === "mod" && !message.sender.hasElevatedPermission) {
        twitch.say(`${message.sender.displayName}, für diesen Befehl musst du Moderator sein!`)
        return
      }
    }
    command.handle({
      ...message,
      commandArguments,
      positionalArguments: positionalArguments || [],
      combinedArguments: parsedCommand?.groups?.commandArguments,
    }).then(returnValue => {
      if (returnValue |> isString) {
        twitch.say(returnValue)
      }
    }).catch(error => {
      twitch.say(`Oh, ${message.sender.displayName}, da hat irgendetwas nicht geklappt. (${error?.message || error})`)
    })
  }

}