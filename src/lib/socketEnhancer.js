import SocketEnhancer from "socket-enhance"

import {logger} from "src/core"

/**
 * @type {import("socket-enhance").SocketEnhancer}
 */
const socketEnhancer = new SocketEnhancer({logger})

export default socketEnhancer