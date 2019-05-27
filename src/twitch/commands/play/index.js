import execa from "execa"
import vlc from "lib/vlc"
import twitch from "src/twitch"

export default {
  permission: "sub-or-vip",
  requiredArguments: 1,
  async handle({commandArguments, sender}) {
    const video = commandArguments._[0]
    const execResult = await execa("E:/Binaries/youtube-dl.exe", ["--get-title", video])
    const title = execResult.stdout
    twitch.say(`PopCorn ${sender.displayName} hat "${title}" hinzugefügt!`)
    await execa("E:/Projects/node-scripts/dist/exe/playVideo.exe", [video])
    const vlcState = await vlc.getState()
    if (!vlcState) {
      return "Kein Lebenszeichen vom Video Player."
    }
  },
}