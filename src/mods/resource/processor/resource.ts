import type { ResourceType } from '../resource.js';
import type { RoomPosition } from 'xxscreeps/game/position.js';
import C from 'xxscreeps/game/constants/index.js';
import { Game } from 'xxscreeps/game/index.js';
import { registerObjectTickProcessor } from 'xxscreeps/engine/processor/index.js';
import { lookForStructureAt } from 'xxscreeps/mods/structure/structure.js';
import { Resource, create } from '../resource.js';

export function drop(pos: RoomPosition, resourceType: ResourceType, amount: number) {
	if (amount < 0) {
		return;
	}
	const room = Game.rooms[pos.roomName]!;
	let remaining = amount;

	// Is there a container to catch the resource?
	const container = lookForStructureAt(room, pos, C.STRUCTURE_CONTAINER);
	if (container) {
		const capacity = container.store.getFreeCapacity(resourceType);
		if (capacity > 0) {
			const amount = Math.min(remaining, capacity);
			remaining -= amount;
			container.store['#add'](resourceType, amount);
			if (remaining === 0) {
				return;
			}
		}
	}

	// Is there already resource on the ground?
	const resources = room.lookForAt(C.LOOK_RESOURCES, pos);
	for (const resource of resources) {
		if (resource.resourceType === resourceType) {
			resource.amount += remaining;
			return;
		}
	}

	// Create new dropped resource here
	const resource = create(pos, resourceType, remaining);
	room['#insertObject'](resource, true);
}

registerObjectTickProcessor(Resource, (resource, context) => {
	resource.amount -= Math.ceil(resource.amount / C.ENERGY_DECAY);
	if (resource.amount <= 0) {
		resource.room['#removeObject'](resource);
	}
	context.setActive();
});
