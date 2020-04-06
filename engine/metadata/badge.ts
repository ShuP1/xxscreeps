import Ajv from 'ajv';
import jsonSchema from './badge.schema.json';

// To rebuild schema:
// npx typescript-json-schema tsconfig.json UserBadge --include engine/metadata/badge.ts --defaultProps --required -o engine/metadata/badge.schema.json

/** @pattern ^#[a-f0-9]{6}$ */
type Color = string;

export type UserBadge = {
	color1: Color;
	color2: Color;
	color3: Color;
	flip: boolean;

	/** @minimum -100 @maximum 100 */
	param: number;

	/** @minimum 1 @maximum 24 */
	type: number;
};

export type Badge = UserBadge | {
	color1: Color;
	color2: Color;
	color3: Color;
	type: {
		path1: string;
		path2: string;
	};
};

const ajv = new Ajv;
const validator = ajv.compile(jsonSchema);

export function validate(badge: any): UserBadge {
	delete badge._watching;
	if (!validator(badge)) {
		throw new Error(`Invalid badge\n${validator.errors![0].message}`);
	}
	return badge;
}
