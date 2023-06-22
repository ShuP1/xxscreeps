import type { Endpoint } from 'xxscreeps/backend/index.js';

const UnreadCountEndpoint: Endpoint = {
	path: '/api/user/messages/unread-count',

	execute() {
		return {
			ok: 1,
			count: 0,
		};
	},
};

export default [ UnreadCountEndpoint ];
