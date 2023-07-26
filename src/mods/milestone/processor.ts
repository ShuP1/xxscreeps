import { registerRoomTickProcessor } from 'xxscreeps/engine/processor/index.js';
import C from "xxscreeps/game/constants/index.js";
import { LAST_TICK } from 'xxscreeps/mods/milestone/backend.js';
import type { Room } from "xxscreeps/game/room";
import type { RoomProcessor } from "xxscreeps/engine/processor/room";

registerRoomTickProcessor((room, context) => {
    const level = room['#level'];
    if (level <= 0) return;

    logRclChange(room, context);

    if (LAST_TICK !== undefined)
        autoStop(room, context, LAST_TICK);
});

async function logRclChange(room: Room, context: RoomProcessor) {
    const MILESTONE_H = "milestone";
    const previousLevel = await context.shard.data.hget(MILESTONE_H, room.name);
    const level = room['#level'];
    if (level == Number(previousLevel)) return;

    console.log('RCL:', room.name, 'level', level, 'at', context.state.time);
    await context.shard.data.hset(MILESTONE_H, room.name, level.toString())
}

function autoStop(room: Room, context: RoomProcessor, limit: number) {
    if (context.state.time > limit) {
        process.kill(process.pid, "SIGINT");
        return;
    }
    if (context.state.time < limit) return;

    let total = 0;
    for (let i = 1; i < room.controller!.level; i++) {
        total += C.CONTROLLER_LEVELS[i]!;
    }
    total += room.controller!.progress!;
    let built = -C.CONSTRUCTION_COST.spawn;
    for (const s of room.find(C.FIND_STRUCTURES)) {
        built +=
        (C.CONSTRUCTION_COST as unknown as Record<string, number>)[
            s.structureType
        ] ?? 0;
    }
    total += built;
    console.log(
        "Done:",
        context.state.time,
        room.name,
        total,
        room.controller!.level,
        room.controller!.progress,
        built
    );
}
