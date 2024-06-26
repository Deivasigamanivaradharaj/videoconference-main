import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ReactTooltip from 'react-tooltip';
import { withRoomContext } from '../RoomContext';
import classnames from 'classnames';
import Spinner from 'react-spinner';
import clipboardCopy from 'clipboard-copy';
import Logger from '../Logger';
import * as appPropTypes from './appPropTypes';
const logger = new Logger('PeerView');


class ScreenView extends React.Component {
	constructor(props) {
		super(props);

		this.state =
		{
			audioVolume: 0, // Integer from 0 to 10.,
			showInfo: window.SHOW_INFO || false,
			videoResolutionWidth: null,
			videoResolutionHeight: null,
			videoCanPlay: false,
			videoElemPaused: false,
			maxSpatialLayer: null
		};

		// Latest received video track.
		// @type {MediaStreamTrack}
		this._audioTrack = null;

		// Latest received video track.
		// @type {MediaStreamTrack}
		this._videoTrack = null;

		// Hark instance.
		// @type {Object}
		this._hark = null;

		// Periodic timer for reading video resolution.
		this._videoResolutionPeriodicTimer = null;

		// requestAnimationFrame for face detection.
		this._faceDetectionRequestAnimationFrame = null;
	}

	render() {
		const {
			isMe,
			videoProducerId,
			videoConsumerId,
			videoRtpParameters,
			consumerSpatialLayers,
			consumerTemporalLayers,
			consumerCurrentSpatialLayer,
			consumerCurrentTemporalLayer,
			consumerPreferredSpatialLayer,
			consumerPreferredTemporalLayer,
			consumerPriority,
			videoVisible,
			videoMultiLayer,
			videoCodec,
			videoScore,
			onChangeMaxSendingSpatialLayer,
			onChangeVideoPreferredLayers,
			onChangeVideoPriority,
			onRequestKeyFrame,
			} = this.props;

		const {
			videoResolutionWidth,
			videoResolutionHeight,
			videoCanPlay,
			videoElemPaused,
			maxSpatialLayer
		} = this.state;



		let ConditionalContent = [];
		

		if (videoProducerId || videoConsumerId) {
			ConditionalContent.push(<h1 key="videotitle">video</h1>)



			if (videoProducerId) {
				ConditionalContent.push(<p key="vpspan">
					{'id: '}
					<span
						className='copiable'
						data-tip='Copy audio consumer id to clipboard'
						onClick={() => clipboardCopy(`"${videoProducerId}"`)}
					>
						{videoProducerId}
					</span>
				</p>
				)

				ConditionalContent.push(<ReactTooltip key="vptp" type='light' effect='solid' delayShow={1500} delayHide={50} />)

			}
			if (videoConsumerId) {

				ConditionalContent.push(<p key="vcspan">
					{'id: '}
					<span
						className='copiable'
						data-tip='Copy video consumer id to clipboard'
						onClick={() => clipboardCopy(`"${videoConsumerId}"`)}
					>
						{videoConsumerId}
					</span>
				</p>)
				ConditionalContent.push(<ReactTooltip key="vctp" type='light' effect='solid' delayShow={1500} delayHide={50} />)


			}

			if (videoCodec) {
				ConditionalContent.push(<p key="vc">codec: {videoCodec}</p>)
			}


			if (videoVisible && videoResolutionWidth !== null) {
				ConditionalContent.push(<p key="vr">resolution: {videoResolutionWidth}x{videoResolutionHeight}</p>)
			}

			if (videoVisible && videoProducerId && videoRtpParameters.encodings.length > 1) {
				ConditionalContent.push(<p key="venc">
					max spatial layer: {maxSpatialLayer > -1 ? maxSpatialLayer : 'none'}
					<span>{' '}</span>
					<span
						className={classnames({
							clickable: maxSpatialLayer > -1
						})}
						onClick={(event) => {
							event.stopPropagation();

							const newMaxSpatialLayer = maxSpatialLayer - 1;

							onChangeMaxSendingSpatialLayer(newMaxSpatialLayer);
							this.setState({ maxSpatialLayer: newMaxSpatialLayer });
						}}
					>
						{'[ down ]'}
					</span>
					<span>{' '}</span>
					<span
						className={classnames({
							clickable: maxSpatialLayer < videoRtpParameters.encodings.length - 1
						})}
						onClick={(event) => {
							event.stopPropagation();

							const newMaxSpatialLayer = maxSpatialLayer + 1;

							onChangeMaxSendingSpatialLayer(newMaxSpatialLayer);
							this.setState({ maxSpatialLayer: newMaxSpatialLayer });
						}}
					>
						{'[ up ]'}
					</span>
				</p>)
			}

			if (!isMe && videoMultiLayer) {
				ConditionalContent.push(<p key="vmlel1">
					{`current spatial-temporal layers: ${consumerCurrentSpatialLayer} ${consumerCurrentTemporalLayer}`}
				</p>)


				ConditionalContent.push(<p key="vmlel2">
					{`preferred spatial-temporal layers: ${consumerPreferredSpatialLayer} ${consumerPreferredTemporalLayer}`}
					<span>{' '}</span>
					<span
						className='clickable'
						onClick={(event) => {
							event.stopPropagation();

							let newPreferredSpatialLayer = consumerPreferredSpatialLayer;
							let newPreferredTemporalLayer;

							if (consumerPreferredTemporalLayer > 0) {
								newPreferredTemporalLayer = consumerPreferredTemporalLayer - 1;
							}
							else {
								if (consumerPreferredSpatialLayer > 0)
									newPreferredSpatialLayer = consumerPreferredSpatialLayer - 1;
								else
									newPreferredSpatialLayer = consumerSpatialLayers - 1;

								newPreferredTemporalLayer = consumerTemporalLayers - 1;
							}

							onChangeVideoPreferredLayers(
								newPreferredSpatialLayer, newPreferredTemporalLayer);
						}}
					>
						{'[ down ]'}
					</span>
					<span>{' '}</span>
					<span
						className='clickable'
						onClick={(event) => {
							event.stopPropagation();

							let newPreferredSpatialLayer = consumerPreferredSpatialLayer;
							let newPreferredTemporalLayer;

							if (consumerPreferredTemporalLayer < consumerTemporalLayers - 1) {
								newPreferredTemporalLayer = consumerPreferredTemporalLayer + 1;
							}
							else {
								if (consumerPreferredSpatialLayer < consumerSpatialLayers - 1)
									newPreferredSpatialLayer = consumerPreferredSpatialLayer + 1;
								else
									newPreferredSpatialLayer = 0;

								newPreferredTemporalLayer = 0;
							}

							onChangeVideoPreferredLayers(
								newPreferredSpatialLayer, newPreferredTemporalLayer);
						}}
					>
						{'[ up ]'}
					</span>
				</p>)
			}


			if (!isMe && videoCodec && consumerPriority > 0) {
				ConditionalContent.push(<p key="vcp">
					{`priority: ${consumerPriority}`}
					<span>{' '}</span>
					<span
						className={classnames({
							clickable: consumerPriority > 1
						})}
						onClick={(event) => {
							event.stopPropagation();

							onChangeVideoPriority(consumerPriority - 1);
						}}
					>
						{'[ down ]'}
					</span>
					<span>{' '}</span>
					<span
						className={classnames({
							clickable: consumerPriority < 255
						})}
						onClick={(event) => {
							event.stopPropagation();

							onChangeVideoPriority(consumerPriority + 1);
						}}
					>
						{'[ up ]'}
					</span>
				</p>)
			}

			if (!isMe && videoCodec) {

				ConditionalContent.push(<p key="vcele">
					<span
						className='clickable'
						onClick={(event) => {
							event.stopPropagation();

							if (!onRequestKeyFrame)
								return;

							onRequestKeyFrame();
						}}
					>
						{'[ request keyframe ]'}
					</span>
				</p>)
			}

			 

		}

		

		


		let eleSpinner = null;

		if (videoVisible && videoScore < 5) {
			eleSpinner = <div className='spinner-container'>
				<Spinner />
			</div>
		}

		let eleVideoPaused = null;

		if (videoElemPaused) {
			eleVideoPaused = <div className='video-elem-paused' />
		}
		
	

		 
	
	
		 
		


		return (
			<div data-component='PeerView'>
				<video
					ref='videoElem'
					className={classnames({
						hidden: !videoVisible || !videoCanPlay,
						'network-error': (
							videoVisible && videoMultiLayer && consumerCurrentSpatialLayer === null
						)
					})}
					autoPlay
					playsInline
					muted
					controls={false}
				/>
				{eleSpinner}
				{eleVideoPaused}
			</div>
		);
	}

	componentDidMount() {
		const { videoTrack } = this.props;

		this._setTracks(videoTrack);
	}

	componentWillUnmount() {
	
		clearInterval(this._videoResolutionPeriodicTimer);
	
		const { videoElem } = this.refs;

		if (videoElem) {
			videoElem.oncanplay = null;
			videoElem.onplay = null;
			videoElem.onpause = null;
		}
	}

	componentWillUpdate() {
		const {
			isMe,
			videoTrack,
			videoRtpParameters
		} = this.props;

		const { maxSpatialLayer } = this.state;

		if (isMe && videoRtpParameters && maxSpatialLayer === null) {
			this.setState(
				{
					maxSpatialLayer: videoRtpParameters.encodings.length - 1
				});
		}
		else if (isMe && !videoRtpParameters && maxSpatialLayer !== null) {
			this.setState({ maxSpatialLayer: null });
		}

		this._setTracks(videoTrack);
	}

	_setTracks(videoTrack) {
		

		if (this._videoTrack === videoTrack)
			return;

	
		this._videoTrack = videoTrack;

		

		this._stopVideoResolution();


		const { videoElem } = this.refs;


		if (videoTrack) {
			const stream = new MediaStream();

			stream.addTrack(videoTrack);
			videoElem.srcObject = stream;

			videoElem.oncanplay = () => this.setState({ videoCanPlay: true });

			videoElem.onplay = () => {
				this.setState({ videoElemPaused: false });

					};

			videoElem.onpause = () => this.setState({ videoElemPaused: true });

			videoElem.play()
				.catch((error) => logger.warn('videoElem.play() failed:%o', error));

			this._startVideoResolution();

		 
		}
		else {
			videoElem.srcObject = null;
		}
	}

	

	_startVideoResolution() {
		this._videoResolutionPeriodicTimer = setInterval(() => {
			const { videoResolutionWidth, videoResolutionHeight } = this.state;
			const { videoElem } = this.refs;

			if (
				videoElem.videoWidth !== videoResolutionWidth ||
				videoElem.videoHeight !== videoResolutionHeight
			) {
				this.setState(
					{
						videoResolutionWidth: videoElem.videoWidth,
						videoResolutionHeight: videoElem.videoHeight
					});
			}
		}, 500);
	}

	_stopVideoResolution() {
		clearInterval(this._videoResolutionPeriodicTimer);

		this.setState(
			{
				videoResolutionWidth: null,
				videoResolutionHeight: null
			});
	}

	

	
}

ScreenView.propTypes =
{
	isMe: PropTypes.bool,
	peer: PropTypes.oneOfType(
		[appPropTypes.Me, appPropTypes.Peer]).isRequired,
	audioProducerId: PropTypes.string,
	videoProducerId: PropTypes.string,
	audioConsumerId: PropTypes.string,
	videoConsumerId: PropTypes.string,
	audioRtpParameters: PropTypes.object,
	videoRtpParameters: PropTypes.object,
	consumerSpatialLayers: PropTypes.number,
	consumerTemporalLayers: PropTypes.number,
	consumerCurrentSpatialLayer: PropTypes.number,
	consumerCurrentTemporalLayer: PropTypes.number,
	consumerPreferredSpatialLayer: PropTypes.number,
	consumerPreferredTemporalLayer: PropTypes.number,
	consumerPriority: PropTypes.number,
	audioTrack: PropTypes.any,
	videoTrack: PropTypes.any,
	audioMuted: PropTypes.bool,
	videoVisible: PropTypes.bool.isRequired,
	videoMultiLayer: PropTypes.bool,
	audioCodec: PropTypes.string,
	videoCodec: PropTypes.string,
	audioScore: PropTypes.any,
	videoScore: PropTypes.any,
	faceDetection: PropTypes.bool.isRequired,
	onChangeDisplayName: PropTypes.func,
	onChangeMaxSendingSpatialLayer: PropTypes.func,
	onChangeVideoPreferredLayers: PropTypes.func,
	onChangeVideoPriority: PropTypes.func,
	onRequestKeyFrame: PropTypes.func,
	onStatsClick: PropTypes.func.isRequired
};


const ScreenViewContainer = withRoomContext(connect(
	null,
	null
)(ScreenView));

export default ScreenViewContainer;