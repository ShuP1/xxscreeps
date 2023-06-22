import type { Creep } from 'xxscreeps/mods/creep/creep.js';
import C from 'xxscreeps/game/constants/index.js';
import * as PathFinder from 'xxscreeps/game/path-finder/index.js';
import { getCostMatrix } from './rooms.js';

export default function(creep: Creep, range: number) {
	const nearCreeps = creep.pos.findInRange(C.FIND_HOSTILE_CREEPS, range - 1)
		.filter(ii => ii.getActiveBodyparts(C.ATTACK) + ii.getActiveBodyparts(C.RANGED_ATTACK) > 0);

	if (nearCreeps.length > 0) {
		const ret = PathFinder.search(creep.pos, nearCreeps.map(ii => ({
			pos: ii.pos,
			range,
		})), {
			maxRooms: 1,
			flee: true,
			roomCallback: getCostMatrix,
		});
		if (ret.path.length > 0) {
			creep.move(creep.pos.getDirectionTo(ret.path[0]));
			creep.say('flee');
			return true;
		}
	}
	return false;
}
