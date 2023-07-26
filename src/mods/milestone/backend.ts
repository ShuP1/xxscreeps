import config from "xxscreeps/config/index.js";

export const LAST_TICK = (config as { milestone?: { ticks?: number } }).milestone?.ticks;
