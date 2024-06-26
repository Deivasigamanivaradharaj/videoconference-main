import React from 'react';
import ChatModerator from './ChatModerator';
import ChatInput from './ChatInput';

const Chat = (props) =>
{

	return (
		<div>
			<ChatModerator />
			<ChatInput />
		</div>
	);
};

export default (Chat);