import {google} from "googleapis"
import config from "lib/config"

const auth = new google.auth.OAuth2(config.youtubeClient.id, config.youtubeClient.secret, config.youtubeClient.redirectUrl)
auth.setCredentials({
  refresh_token: config.youtubeClient.refreshToken,
})
export default google.youtube({
  auth,
  version: "v3",
})