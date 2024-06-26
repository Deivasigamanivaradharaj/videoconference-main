import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ReactTooltip from 'react-tooltip';
import classnames from 'classnames';
import * as appPropTypes from './appPropTypes';
import { withRoomContext } from '../RoomContext';
import * as requestActions from '../redux/requestActions';
import { Appear } from './transitions';
import Me from './Me';
import Peers from './Peers';
import Notifications from './Notifications';
import NetworkThrottle from './NetworkThrottle';
class Room extends React.Component {


	render() {
		const {
			roomClient,
			room,
			me,
			amActiveSpeaker
		} = this.props;



		let eleNetworkThrottle = null;
		if (window.NETWORK_THROTTLE_SECRET) {
			eleNetworkThrottle = <NetworkThrottle secret={window.NETWORK_THROTTLE_SECRET} />
		}

	

		let sidebarTools = [];
		sidebarTools.push(<div key="el1" className='state'>
		<div className={classnames('icon', room.state)} />
		{/* <p className={classnames('text', room.state)}>{room.state}</p> */}
	</div>)
		if (me && me.roles.indexOf("organizer") > -1) {
			sidebarTools.push(<div  key="el2"
					className={classnames('button', 'hide-videos', {
						on: !room.isVideoAllLocked
						
					})}
					data-tip={'Show/hide participants\' video'}
					onClick={() => {
						room.isVideoAllLocked
							? roomClient.playAllPeerVideo()
							: roomClient.stopAllPeerVideo();
					}}
				/>)

				sidebarTools.push(<div key="el3"
					className={classnames('button', 'mute-audio', {
						on: !room.isAudioAllLocked
					})}
					data-tip={'Mute/unmute participants\' audio'}
					onClick={() => {
						room.isAudioAllLocked
							? roomClient.unmuteAllPeers()
							: roomClient.muteAllPeers();
					}}
				/>)

				// sidebarTools.push(<div
				// 	className={classnames('button', 'restart-ice', {
				// 		disabled: me.restartIceInProgress
				// 	})}
				// 	data-tip='Restart ICE'
				// 	onClick={() => roomClient.restartIce()}
				// />)
		 
		}
		
		return (
			<Appear duration={300}>
				<div data-component='Room'>
					{eleNetworkThrottle}
					<Notifications />



					{/* <div className='chat-input-container'>
							<ChatInput />
						</div> */}


				
					<div
						className={classnames('me-container', {
							'active-speaker': amActiveSpeaker
						})}
					>
						<Me />
					</div>
					<div className='sidebar'>
							{sidebarTools}
						</div>
                   
					<section className="Column2">
						<Peers />
					</section>
					<ReactTooltip

						type='light'
						effect='solid'
						delayShow={100}
						delayHide={100}
						delayUpdate={50}
					/>
				</div>


			</Appear>
		);
	}

	componentDidMount() {
		const { roomClient } = this.props;

		roomClient.join({ roomId: window.ROOM_ID, joinVideo: false });
	}
}

Room.propTypes =
{
	roomClient: PropTypes.any.isRequired,
	room: appPropTypes.Room.isRequired,
	me: appPropTypes.Me.isRequired,
	amActiveSpeaker: PropTypes.bool.isRequired,
	onRoomLinkCopy: PropTypes.func.isRequired
};

const mapStateToProps = (state) => {
	return {
		room: state.room,
		me: state.me,
		amActiveSpeaker: state.me.id === state.room.activeSpeakerId
	};
};

const mapDispatchToProps = (dispatch) => {
	return {
		onRoomLinkCopy: () => {
			dispatch(requestActions.notify(
				{
					text: 'Room link copied to the clipboard'
				}));
		}
	};
};

const RoomContainer = withRoomContext(connect(
	mapStateToProps,
	mapDispatchToProps
)(Room));

export default RoomContainer;
