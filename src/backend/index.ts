import type Koa from 'koa';
import type Router from 'koa-router';
import type { BackendContext } from './context.js';
import type { Database, Shard } from 'xxscreeps/engine/db/index.js';
import type { Implementation } from 'xxscreeps/utility/types.js';
import type { RoomObject } from 'xxscreeps/game/object.js';
import { MapRender, Render, TerrainRender } from './symbols.js';
export { hooks } from './symbols.js';

// Koa middleware & generic backend route types

/// <reference path="./auth/index.ts" />
export interface Context {
	backend: BackendContext;
	db: Database;
	request: {
		body: any;
	};
	shard: Shard;
}
export interface State {}
export type Method = 'delete' | 'get' | 'post' | 'put';
export type Middleware = Koa.Middleware<State, Context>;

export type Endpoint = {
	path: string;
	method?: Method;

	execute(context: Router.RouterContext<State, Context>): any;
};

// `RoomObject` render symbols
type RenderedRoomObject = {
	_id: string;
	type: string;
	x: number;
	y: number;
};
declare module 'xxscreeps/game/object' {
	interface RoomObject {
		[Render]: (previousTime?: number) => RenderedRoomObject | undefined;
		[MapRender]: (object: any) => string | undefined;
		[TerrainRender]: (object: any) => number | undefined;
	}
}

// Backend render hooks
export function bindRenderer<Type extends RoomObject>(
	object: Implementation<Type>,
	render: (object: Type, next: () => RenderedRoomObject, ...rest: Parameters<RoomObject[typeof Render]>) => RenderedRoomObject | undefined,
) {
	const { prototype } = object;
	const parent = Object.getPrototypeOf(prototype);
	prototype[Render] = function(...rest) {
		return render(this, () => parent[Render].call(this, ...rest), ...rest);
	};
}

export function bindMapRenderer<Type extends RoomObject>(object: Implementation<Type>, render: (object: Type) => string | undefined) {
	object.prototype[MapRender] = render;
}

export function bindTerrainRenderer<Type extends RoomObject>(object: Implementation<Type>, render: (object: Type) => number | undefined) {
	object.prototype[TerrainRender] = render;
}
