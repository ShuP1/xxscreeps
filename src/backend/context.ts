import { Shard } from 'xxscreeps/engine/model/shard';
import { readWorld, World } from 'xxscreeps/game/map';
import { Mutex } from 'xxscreeps/storage/mutex';
import { Authentication } from './auth/model';
import * as User from 'xxscreeps/engine/metadata/user';

export class BackendContext {
	private constructor(
		public readonly shard: Shard,
		public readonly world: World,
		public readonly accessibleRooms: Set<string>,
		public readonly gameMutex: Mutex,
		public readonly auth: Authentication,
	) {}

	static async connect() {
		// Connect to services
		const shard = await Shard.connect('shard0');
		const world = readWorld(await shard.blob.reqBuffer('terrain'));
		const gameMutex = await Mutex.connect('game', shard.data, shard.pubsub);
		const auth = await Authentication.connect(shard.blob);
		const rooms = await shard.data.smembers('rooms');
		const context = new BackendContext(shard, world, new Set(rooms), gameMutex, auth);
		return context;
	}

	async disconnect() {
		await this.gameMutex.disconnect();
		this.shard.disconnect();
	}

	async loadUser(id: string) {
		return User.read(await this.shard.blob.reqBuffer(`user/${id}/info`));
	}
}