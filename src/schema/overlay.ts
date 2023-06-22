import type { BufferView } from './buffer-view.js';
import type { StructLayout } from './layout.js';
import type { Builder } from './index.js';
import type { BufferObject } from './buffer-object.js';
import { getBuffer, getOffset } from './buffer-object.js';
import type { TypeOf } from './format.js';
import { Variant } from './format.js';
import { makeTypeReader } from './read.js';
import { entriesWithSymbols } from './symbol.js';

const { defineProperty } = Object;
const { apply } = Reflect;

type GetterReader = (this: BufferObject) => any;

const injected = new WeakSet();
export function injectGetters(layout: StructLayout, prototype: object, builder: Builder) {
	// Hacky double-inject prevention. This occurs, for example, with RoomPosition which is loaded
	// into more than one schema
	if (injected.has(prototype)) {
		return;
	}
	injected.add(prototype);

	for (const [ key, member ] of entriesWithSymbols(layout.struct)) {
		const { member: layout, offset } = member;

		// Make getter
		const get = function(): GetterReader {

			// Get reader for this member
			const get = function() {
				const read = makeTypeReader(layout, builder);
				const reader: GetterReader = function() {
					return read(getBuffer(this), offset + getOffset(this));
				};
				Object.defineProperty(read, 'name', {
					value: `${typeof key === 'symbol' ? key.description : key}`,
				});
				return reader;
			}();

			// Memoize everything except integer access
			if (!(
				layout === 'int8' || layout === 'int16' || layout === 'int32' ||
				layout === 'uint8' || layout === 'uint16' || layout === 'uint32' ||
				layout === 'bool'
			)) {
				return function() {
					const value = apply(get, this, []);
					defineProperty(this, key, {
						enumerable,
						writable: true,
						value,
					});
					return value;
				};
			}

			// Getter w/ no memoization
			return get;
		}();

		// Define getter on proto
		const enumerable = typeof key === 'string' && !key.startsWith('#');
		Object.defineProperty(prototype, key, {
			enumerable,
			get,
			set(value) {
				defineProperty(this, key, {
					enumerable,
					writable: true,
					value,
				});
			},
		});
	}

	// Add Variant key
	const variant = layout.variant;
	if (variant !== undefined) {
		Object.defineProperty(prototype, Variant, {
			value: variant,
		});
	}
}

// Helper types for `withOverlay`
type AbstractBufferObjectSubclass<Instance extends BufferObject = any> =
	abstract new(view?: BufferView, offset?: number) => Instance;
type BufferObjectSubclass<Instance extends BufferObject> =
	new(view?: BufferView, offset?: number) => Instance;
type BufferObjectConstructor<
	Base extends AbstractBufferObjectSubclass,
	Instance extends BufferObject,
> = Omit<Base, 'prototype'> & (Base extends BufferObjectSubclass<any> ?
	BufferObjectSubclass<Instance> : AbstractBufferObjectSubclass<Instance>);

/**
 * Injects types inherited from format into class prototype. Just passes the base class back
 * unchanged in JS, this is only used for type information.
 * @param base Base class
 * @param type Schema format
 */
export function withOverlay<Base extends AbstractBufferObjectSubclass, Type>(
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	base: Base, type: Type):
	Base extends AbstractBufferObjectSubclass<infer Instance> ?
		BufferObjectConstructor<Base, Instance & TypeOf<Type>> : never {
	return base as never;
}
