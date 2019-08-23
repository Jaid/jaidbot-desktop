import JaidCore from "jaid-core"

import defaults from "./config.yml"

const core = new JaidCore({
  name: _PKG_TITLE,
  version: _PKG_VERSION,
  useGot: true,
  configSetup: {
    defaults,
    secretKeys: [
      "vlcApiPassword",
      "botPassword",
    ],
  },
})

export const logger = core.logger
export const got = core.got
export const config = core.config

export default core