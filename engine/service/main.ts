import config from '~/engine/config';
import * as GameSchema from '~/engine/metadata/game';
import { AveragingTimer } from '~/lib/averaging-timer';
import { getOrSet, makeResolver, mapInPlace } from '~/lib/utility';
import * as Storage from '~/storage';
import { Channel } from '~/storage/channel';
import { Mutex } from '~/storage/mutex';
import { Queue } from '~/storage/queue';
import type { GameMessage, ProcessorMessage, ProcessorQueueElement, RunnerMessage, ServiceMessage } from '.';

export default async function() {
	// Open channels
	const storage = await Storage.connect('shard0');
	const { persistence } = storage;
	const [
		roomsQueue, usersQueue, processorChannel, runnerChannel, serviceChannel, gameMutex,
	] = await Promise.all([
		Queue.connect<ProcessorQueueElement>(storage, 'processRooms', true),
		Queue.connect(storage, 'runnerUsers'),
		new Channel<ProcessorMessage>(storage, 'processor').subscribe(),
		new Channel<RunnerMessage>(storage, 'runner').subscribe(),
		new Channel<ServiceMessage>(storage, 'service').subscribe(),
		Mutex.connect(storage, 'game'),
	]);
	await serviceChannel.publish({ type: 'mainConnected' });

	// Run main game processing loop
	let gameMetadata: GameSchema.Type | undefined;
	let activeRooms: string[] = [];
	let activeUsers: string[] = [];
	const performanceTimer = new AveragingTimer(1000);

	// Ctrl+C handler
	let delayResolve: Resolver<boolean> | undefined;
	let shuttingDown = false;

	// Listen for service updates
	serviceChannel.listen(message => {
		if (message.type === 'gameModified') {
			gameMetadata = undefined;
		} else if (message.type === 'shutdown') {
			shuttingDown = true;
			delayResolve?.resolve?.(false);
		}
	});

	try {
		do {
			await gameMutex.scope(async() => {
				// Start timer
				performanceTimer.start();
				const timeStartedLoop = Date.now();

				// Refresh current game status
				if (!gameMetadata) {
					gameMetadata = GameSchema.read(await persistence.get('game'));
					activeRooms = [ ...gameMetadata.activeRooms ];
					activeUsers = [ ...gameMetadata.users ];
				}

				// Add users to runner queue
				usersQueue.version(`${gameMetadata.time}`);
				await Promise.all([ usersQueue.clear(), usersQueue.push(activeUsers) ]);
				await runnerChannel.publish({ type: 'processUsers', time: gameMetadata.time });

				// Wait for runners to finish
				const processedUsers = new Set<string>();
				const intentsByRoom = new Map<string, Set<string>>();
				for await (const message of runnerChannel) {
					if (message.type === 'runnerConnected') {
						await runnerChannel.publish({ type: 'processUsers', time: gameMetadata.time });

					} else if (message.type === 'processedUser') {
						processedUsers.add(message.userId);
						for (const roomName of message.roomNames) {
							getOrSet(intentsByRoom, roomName, () => new Set).add(message.userId);
						}
						if (activeUsers.length === processedUsers.size) {
							break;
						}
					}
				}

				// Add rooms to queue and notify processors
				roomsQueue.version(`${gameMetadata.time}`);
				const roomsQueueElements = [ ...mapInPlace(activeRooms, room => ({
					room,
					users: [ ...intentsByRoom.get(room) ?? [] ],
				})) ];
				await Promise.all([ roomsQueue.clear(), roomsQueue.push(roomsQueueElements) ]);
				await processorChannel.publish({ type: 'processRooms', time: gameMetadata.time });

				// Handle incoming processor messages
				const processedRooms = new Set<string>();
				const flushedRooms = new Set<string>();
				for await (const message of processorChannel) {
					if (message.type === 'processorConnected') {
						await processorChannel.publish({ type: 'processRooms', time: gameMetadata.time });

					} else if (message.type === 'processedRoom') {
						processedRooms.add(message.roomName);
						if (activeRooms.length === processedRooms.size) {
							await processorChannel.publish({ type: 'flushRooms' });
						}

					} else if (message.type === 'flushedRooms') {
						message.roomNames.forEach(roomName => flushedRooms.add(roomName));
						if (activeRooms.length === flushedRooms.size) {
							break;
						}
					}
				}

				// Update game state
				const previousTime = gameMetadata.time++;
				await persistence.set('game', GameSchema.write(gameMetadata));

				// Finish up
				const now = Date.now();
				const timeTaken = now - timeStartedLoop;
				const averageTime = Math.floor(performanceTimer.stop() / 10000) / 100;
				console.log(`Tick ${previousTime} ran in ${timeTaken}ms; avg: ${averageTime}ms`);
				await new Channel<GameMessage>(storage, 'main').publish({ type: 'tick', time: gameMetadata.time });
			});

			// Shutdown request came in during game loop
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			if (shuttingDown) {
				break;
			}

			// Add delay
			const delay = config.game?.tickSpeed ?? 250 - Date.now();
			let delayPromise: Promise<boolean>;
			[ delayPromise, delayResolve ] = makeResolver();
			setTimeout(() => delayResolve!.resolve(true), delay).unref();
			if (!await delayPromise) {
				break;
			}
		} while (true);

		// Save on graceful exit
		await persistence.save();

	} finally {
		// Clean up
		storage.disconnect();
		processorChannel.disconnect();
		runnerChannel.disconnect();
		gameMutex.disconnect();
		await serviceChannel.publish({ type: 'mainDisconnected' });
		serviceChannel.disconnect();
	}
}
