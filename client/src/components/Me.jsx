import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ReactTooltip from 'react-tooltip';
import classnames from 'classnames';
import * as cookiesManager from '../cookiesManager';
import * as appPropTypes from './appPropTypes';
import { withRoomContext } from '../RoomContext';
import * as stateActions from '../redux/stateActions';
import PeerView from './PeerView';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
 
class Me extends React.Component {
	constructor(props) {
		super(props);

		this._mounted = false;
		this._rootNode = null;
	}

	render() {
		const {
			roomClient,
			connected,
			me,
			audioProducer,
			videoProducer,
			faceDetection,
			onSetStatsPeerId,
			ScreenShared
		} = this.props;

		let micState;

		if (!me.canSendMic)
			micState = 'unsupported';
		else if (!audioProducer)
			micState = 'unsupported';
		else if (!audioProducer.paused)
			micState = 'on';
		else
			micState = 'off';

		let webcamState;

		if (!me.canSendWebcam)
			webcamState = 'unsupported';
		else if (videoProducer && videoProducer.type !== 'share')
			webcamState = 'on';
		else
			webcamState = 'off';

		let changeWebcamState;

		if (Boolean(videoProducer) && videoProducer.type !== 'share' && me.canChangeWebcam)
			changeWebcamState = 'on';
		else
			changeWebcamState = 'unsupported';

		let shareState;

		if (ScreenShared)
			shareState = 'on';
		else
			shareState = 'off';

		const videoVisible = Boolean(videoProducer) && !videoProducer.paused;

		let tip;

		// if (!me.displayNameSet)
		// 	tip = 'Click on your name to change it';


		let eleConnected = [];

		if (connected) {

			if (!me.isAudioLocked) {
				eleConnected.push(
					<div key="el1"
						className={classnames('button', 'mic', micState)}
						onClick={() => {
							micState === 'on'
								? roomClient.muteMic()
								: roomClient.unmuteMic();
						}}
					/>)
			}

			if (!me.isVideoLocked) {

				eleConnected.push(<div key="el2"
					className={classnames('button', 'webcam', webcamState, {
						disabled: me.webcamInProgress || me.shareInProgress
					})}
					onClick={() => {
						if (webcamState === 'on') {
							cookiesManager.setDevices({ webcamEnabled: false });
							roomClient.disableWebcam();
						}
						else {
							cookiesManager.setDevices({ webcamEnabled: true });
							roomClient.enableWebcam();
						}
					}}
				/>)
			}

			eleConnected.push(<div key="el3"
				className={classnames('button', 'change-webcam', changeWebcamState, {
					disabled: me.webcamInProgress || me.shareInProgress
				})}
				onClick={() => roomClient.changeWebcam()}
			/>)

			if (me.roles.indexOf('presenter') > -1) {
				eleConnected.push(<div key="el4"
					className={classnames('button', 'share', shareState, {
						disabled: me.shareInProgress || me.webcamInProgress
					})}
					onClick={() => {
						if (shareState === 'on')
							roomClient.disableShare();
						else
							roomClient.enableShare();
					}}
				/>)
				
			}
			if (me.roles.indexOf('organizer') === -1) {
				eleConnected.push(<div className={classnames("button icon pl-2 pt-2 ",{"on"  : me.raisedHand,"text-white": !me.raisedHand })}><FontAwesomeIcon key="el4" size="1x" icon={`${me.raisedHand ? 'hand-point-up' : 'hand-point-down'}`} 
					onClick={() => {
						if (!me.raisedHand)
							roomClient.setRaisedHand(true);
						else
							roomClient.setRaisedHand(false);
					}}
					/>
				    </div>
					)
			}
		}

		return (
			<div

				data-component='Me'
				ref={(node) => (this._rootNode = node)}
				data-tip={tip}
				data-tip-disable={!tip}
			>
				<div className='controls'>
					{eleConnected}
				</div>
				<PeerView
					isMe
					peer={me}
					audioProducerId={audioProducer ? audioProducer.id : null}
					videoProducerId={videoProducer ? videoProducer.id : null}
					audioRtpParameters={audioProducer ? audioProducer.rtpParameters : null}
					videoRtpParameters={videoProducer ? videoProducer.rtpParameters : null}
					audioTrack={audioProducer ? audioProducer.track : null}
					videoTrack={videoProducer ? videoProducer.track : null}
					videoVisible={videoVisible}
					audioCodec={audioProducer ? audioProducer.codec : null}
					videoCodec={videoProducer ? videoProducer.codec : null}
					audioScore={audioProducer ? audioProducer.score : null}
					videoScore={videoProducer ? videoProducer.score : null}
					faceDetection={faceDetection}
					onChangeDisplayName={(displayName) => {
						roomClient.changeDisplayName(displayName);
					}}
					onChangeMaxSendingSpatialLayer={(spatialLayer) => {
						roomClient.setMaxSendingSpatialLayer(spatialLayer);
					}}
					onStatsClick={onSetStatsPeerId}
				/>

				<ReactTooltip
					type='light'
					effect='solid'
					delayShow={100}
					delayHide={100}
					delayUpdate={50}
				/>
			</div>
		);
	}

	componentDidMount() {
		this._mounted = true;

		// setTimeout(() =>
		// {
		// 	if (!this._mounted || this.props.me.displayNameSet)
		// 		return;

		// 	ReactTooltip.show(this._rootNode);
		// }, 4000);



	}

	componentWillUnmount() {
		this._mounted = false;
	}

	componentDidUpdate(prevProps) {
		// if (!prevProps.me.displayNameSet && this.props.me.displayNameSet)
		// 	ReactTooltip.hide(this._rootNode);
	}
}

Me.propTypes =
{
	roomClient: PropTypes.any.isRequired,
	connected: PropTypes.bool.isRequired,
	me: appPropTypes.Me.isRequired,
	audioProducer: appPropTypes.Producer,
	videoProducer: appPropTypes.Producer,
	faceDetection: PropTypes.bool.isRequired,
	onSetStatsPeerId: PropTypes.func.isRequired,
	ScreenShared:PropTypes.bool,
};

const mapStateToProps = (state) => {
	const producersArray = Object.values(state.producers);
	const audioProducer =
		producersArray.find((producer) => producer.track.kind === 'audio');
	const videoProducer =
		producersArray.find((producer) => producer.track.kind === 'video' &&  producer.type !== 'share');

	const videoProducer1 =
		producersArray.find((producer) => producer.track.kind === 'video' &&  producer.type === 'share');


	return {
		connected: state.room.state === 'connected',
		me: state.me,
		audioProducer: audioProducer,
		videoProducer: videoProducer,
		faceDetection: state.room.faceDetection,
		ScreenShared:(videoProducer1)
	};
};

const mapDispatchToProps = (dispatch) => {
	return {
		onSetStatsPeerId: (peerId) => dispatch(stateActions.setRoomStatsPeerId(peerId))
	};
};

const MeContainer = withRoomContext(connect(
	mapStateToProps,
	mapDispatchToProps
)(Me));

export default MeContainer;
