import * as TerrainSchema from '~/game/terrain';
import { getReader, getSchema, makeVector, withType, FormatShape } from '~/lib/schema';
import { bindInterceptorsToSchema } from '~/lib/schema/interceptor';
import { mapInPlace } from '~/lib/utility';

export type World = Map<string, TerrainSchema.Terrain>;

export const schema = getSchema({
	Terrain: TerrainSchema.format,
	World: withType<World>(makeVector(TerrainSchema.format)),
});

export const interceptorSchema = bindInterceptorsToSchema(schema, {
	Terrain: TerrainSchema.interceptors,
	World: {
		compose: (world: FormatShape<typeof TerrainSchema.format>[]) =>
			new Map(world.map(room => [ room.name, room.terrain ])),
		decompose: (world: World) => {
			const vector = [ ...mapInPlace(world.entries(), ([ name, terrain ]) => ({ name, terrain })) ];
			vector.sort((left, right) => left.name.localeCompare(right.name));
			return vector;
		},
	},
});

export const readWorld = getReader(schema.World, interceptorSchema);
