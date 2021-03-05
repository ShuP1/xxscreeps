import * as C from 'xxscreeps/game/constants';
import * as Game from 'xxscreeps/game/game';
import type { RoomPosition } from 'xxscreeps/game/position';
import { instantiate } from 'xxscreeps/util/utility';
import { StructureContainer } from 'xxscreeps/game/objects/structures/container';
import { registerObjectTickProcessor } from 'xxscreeps/processor';
import { newRoomObject } from './room-object';
import * as StoreIntent from './store';

export function create(pos: RoomPosition) {
	const ownedController = Game.rooms[pos.roomName]!.controller?.owner;
	return instantiate(StructureContainer, {
		...newRoomObject(pos),
		hits: C.EXTENSION_HITS,
		store: StoreIntent.create(C.CONTAINER_CAPACITY),
		_nextDecayTime: Game.time + (ownedController ?
			C.CONTAINER_DECAY_TIME_OWNED : C.CONTAINER_DECAY_TIME),
		_owner: undefined,
	});
}

registerObjectTickProcessor(StructureContainer, container => {
	if (container.ticksToDecay === 0) {
		const ownedController = Game.rooms[container.pos.roomName]!.controller?.owner;
		container.hits -= C.CONTAINER_DECAY;
		container._nextDecayTime = Game.time + (ownedController ?
			C.CONTAINER_DECAY_TIME_OWNED : C.CONTAINER_DECAY_TIME);
	}
});
