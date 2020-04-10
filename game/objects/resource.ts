import * as C from '~/game/constants';
import type { shape } from '~/engine/schema/resource';
import { withOverlay } from '~/lib/schema';
import { RoomObject } from './room-object';

export type ResourceType = typeof C.RESOURCES_ALL[number];
export class Resource extends withOverlay<typeof shape>()(RoomObject) {
	get energy() { return this.resourceType === 'energy' ? this.amount : undefined }
	get _lookType() { return C.LOOK_RESOURCES }
}
