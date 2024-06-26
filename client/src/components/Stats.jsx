import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Appear } from './transitions';
import { withRoomContext } from '../RoomContext';
import * as stateActions from '../redux/stateActions';

class Stats extends React.Component {
	constructor(props) {
		super(props);

		this.state =
		{
			sendTransportRemoteStats: null,
			sendTransportLocalStats: null,
			recvTransportRemoteStats: null,
			recvTransportLocalStats: null,
			audioProducerRemoteStats: null,
			audioProducerLocalStats: null,
			videoProducerRemoteStats: null,
			videoProducerLocalStats: null,
			chatDataProducerRemoteStats: null,
			botDataProducerRemoteStats: null,
			audioConsumerRemoteStats: null,
			audioConsumerLocalStats: null,
			videoConsumerRemoteStats: null,
			videoConsumerLocalStats: null,
			chatDataConsumerRemoteStats: null,
			botDataConsumerRemoteStats: null
		};

		this._delayTimer = null;
	}

	render() {
		const {
			peerId,
			peerDisplayName,
			isMe,
			onClose
		} = this.props;

		
     let eletitle = <h1>Stats of {peerDisplayName}</h1>
		
	    if(isMe){
			eletitle=<h1>Your Stats</h1>
		}


		return (
			<div data-component='Stats'>
				<div className={classnames('content', { visible: peerId })}>
					<div className='header'>
						<div className='info'>
							<div
								className='close-icon'
								onClick={onClose}
							/>
						</div>

							{eletitle}

						<div className='list'>
						 
						</div>
					</div>

					<div className='stats'>
					 
					</div>
				</div>
			</div>
		);
	}

	componentDidUpdate(prevProps) {
		const { peerId } = this.props;

		if (peerId && !prevProps.peerId) {
			this._delayTimer = setTimeout(() => this._start(), 250);
		}
		else if (!peerId && prevProps.peerId) {
			this._stop();
		}
		else if (peerId && prevProps.peerId && peerId !== prevProps.peerId) {
			this._stop();
			this._start();
		}
	}

	async _start() {
		const {
			roomClient,
			isMe,
			audioConsumerId,
			videoConsumerId,
			chatDataConsumerId,
			botDataConsumerId
		} = this.props;

		
		this._delayTimer = setTimeout(() => this._start(), 2500);
	}

	_stop() {
		clearTimeout(this._delayTimer);

		this.setState(
			{
				sendTransportRemoteStats: null,
				sendTransportLocalStats: null,
				recvTransportRemoteStats: null,
				recvTransportLocalStats: null,
				audioProducerRemoteStats: null,
				audioProducerLocalStats: null,
				videoProducerRemoteStats: null,
				videoProducerLocalStats: null,
				chatDataProducerRemoteStats: null,
				botDataProducerRemoteStats: null,
				audioConsumerRemoteStats: null,
				audioConsumerLocalStats: null,
				videoConsumerRemoteStats: null,
				videoConsumerLocalStats: null,
				chatDataConsumerRemoteStats: null,
				botDataConsumerRemoteStats: null
			});
	}

 
	 
}



Stats.propTypes =
{
	roomClient: PropTypes.any.isRequired,
	peerId: PropTypes.string,
	peerDisplayName: PropTypes.string,
	isMe: PropTypes.bool,
	audioConsumerId: PropTypes.string,
	videoConsumerId: PropTypes.string,
	chatDataConsumerId: PropTypes.string,
	botDataConsumerId: PropTypes.string,
	onClose: PropTypes.func.isRequired
};

const mapStateToProps = (state) => {
	const { room, me, peers, consumers, dataConsumers } = state;
	const { statsPeerId } = room;

	if (!statsPeerId)
		return {};

	const isMe = statsPeerId === me.id;
	const peer = isMe ? me : peers[statsPeerId];
	let audioConsumerId;
	let videoConsumerId;
	let chatDataConsumerId;


	if (isMe) {
		// for (const dataConsumerId of Object.keys(dataConsumers)) {
		// 	const dataConsumer = dataConsumers[dataConsumerId];

		// 	if (dataConsumer.label === 'bot')
		// 		botDataConsumerId = dataConsumer.id;
		// }
	}
	else {
		// for (const consumerId of peer.consumers) {
		// 	const consumer = consumers[consumerId];

		// 	switch (consumer.track.kind) {
		// 		case 'audio':
		// 			audioConsumerId = consumer.id;
		// 			break;

		// 		case 'video':
		// 			videoConsumerId = consumer.id;
		// 			break;
		// 		default :
		// 		break;
		// 	}
		// }

		// for (const dataConsumerId of peer.dataConsumers) {
		// 	const dataConsumer = dataConsumers[dataConsumerId];

		// 	if (dataConsumer.label === 'chat')
		// 		chatDataConsumerId = dataConsumer.id;
		// }
	}

	return {
		peerId: peer.id,
		peerDisplayName: peer.displayName,
		isMe,
		audioConsumerId,
		videoConsumerId,
		chatDataConsumerId
	
	};
};

const mapDispatchToProps = (dispatch) => {
	return {
		onClose: () => dispatch(stateActions.setRoomStatsPeerId(null))
	};
};

const StatsContainer = withRoomContext(connect(
	mapStateToProps,
	mapDispatchToProps
)(Stats));

export default StatsContainer;
