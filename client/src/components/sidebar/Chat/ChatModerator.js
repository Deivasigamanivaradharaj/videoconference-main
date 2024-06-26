import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { withRoomContext } from '../../../RoomContext';
import { permissions } from '../../../permissions';
import { makePermissionSelector } from '../../../Selectors';
import { Button } from 'react-bootstrap';




const ChatModerator = (props) =>
{

	const {
		roomClient,
		isChatModerator,
		room,
		classes
	} = props;

	if (!isChatModerator)
		return null;

	return (
		<ul   >
			<li   >
				{/* <FormattedMessage
					id='room.moderatoractions'
					defaultMessage='Moderator actions'
				/> */}
			</li>
			<Button
				aria-label='Clear chat'
				className={classes.actionButton}
				variant='contained'
				color='secondary'
				disabled={room.clearChatInProgress}
				onClick={() => roomClient.clearChat()}
			>
				{/* <FormattedMessage
					id='room.clearChat'
					defaultMessage='Clear chat'
				/> */}
			</Button>
		</ul>
	);
};

ChatModerator.propTypes =
{
	roomClient      : PropTypes.any.isRequired,
	isChatModerator : PropTypes.bool,
	room            : PropTypes.object,
	classes         : PropTypes.object.isRequired
};

const makeMapStateToProps = () =>
{
	const hasPermission = makePermissionSelector(permissions.MODERATE_CHAT);

	const mapStateToProps = (state) =>
		({
			isChatModerator : hasPermission(state),
			room            : state.room
		});

	return mapStateToProps;
};

export default withRoomContext(connect(
	makeMapStateToProps,
	null,
	null,
	{
		areStatesEqual : (next, prev) =>
		{
			return (
				prev.room === next.room &&
				prev.me === next.me &&
				prev.peers === next.peers
			);
		}
	}
)(ChatModerator));