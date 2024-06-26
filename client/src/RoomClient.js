import Logger from './Logger';
import hark from 'hark';
import { getSignalingUrl } from './urlFactory';
import { SocketTimeoutError } from './utils';
import * as requestActions from './redux/actions/requestActions';
import * as meActions from './redux/actions/meActions';
import * as roomActions from './redux/actions/roomActions';
import * as peerActions from './redux/actions/peerActions';
import * as peerVolumeActions from './redux/actions/peerVolumeActions';
import * as settingsActions from './redux/actions/settingsActions';
import * as chatActions from './redux/actions/chatActions';
import * as fileActions from './redux/actions/fileActions';
import * as lobbyPeerActions from './redux/actions/lobbyPeerActions';
import * as consumerActions from './redux/actions/consumerActions';
import * as producerActions from './redux/actions/producerActions';
import * as notificationActions from './redux/actions/notificationActions';
import * as transportActions from './redux/actions/transportActions';
import * as stateActions from './redux/stateActions';
import * as cookiesManager from './cookiesManager';

let createTorrent;

 

let saveAs;

let mediasoupClient;

let io;

let ScreenShare;

let Spotlights;

let requestTimeout,
	transportOptions,
	lastN,
	mobileLastN;

if (process.env.NODE_ENV !== 'test')
{
	({
		requestTimeout,
		transportOptions,
		lastN,
		mobileLastN
	} = window.config);
}

const logger = new Logger('RoomClient');

const ROOM_OPTIONS =
{
	requestTimeout   : requestTimeout,
	transportOptions : transportOptions
};

const VIDEO_CONSTRAINS =
{
	'low' :
	{
		width       : { ideal: 320 },
		aspectRatio : 1.334
	},
	'medium' :
	{
		width       : { ideal: 640 },
		aspectRatio : 1.334
	},
	'high' :
	{
		width       : { ideal: 1280 },
		aspectRatio : 1.334
	},
	'veryhigh' :
	{
		width       : { ideal: 1920 },
		aspectRatio : 1.334
	},
	'ultra' :
	{
		width       : { ideal: 3840 },
		aspectRatio : 1.334
	}
};

const PC_PROPRIETARY_CONSTRAINTS =
{
	optional : [ { googDscp: true } ]
};

const VIDEO_SIMULCAST_ENCODINGS =
[
	{ scaleResolutionDownBy: 4 },
	{ scaleResolutionDownBy: 2 },
	{ scaleResolutionDownBy: 1 }
];

// Used for VP9 webcam video.
const VIDEO_KSVC_ENCODINGS =
[
	{ scalabilityMode: 'S3T3_KEY' }
];

// Used for VP9 desktop sharing.
const VIDEO_SVC_ENCODINGS =
[
	{ scalabilityMode: 'S3T3', dtx: true }
];

let store;


export default class RoomClient
{
	/**
	 * @param  {Object} data
	 * @param  {Object} data.store - The Redux store.

	 */
	static init(data)
	{
		store = data.store;
	
	}

	constructor(
		{
			peerId,
			accessCode,
			device,
			produce,
			forceTcp,
			displayName,
			muted,
			basePath
		} = {})
	{
		if (!peerId)
			throw new Error('Missing peerId');
		else if (!device)
			throw new Error('Missing device');

		logger.debug(
			'constructor() [peerId: "%s", device: "%s", produce: "%s", forceTcp: "%s", displayName ""]',
			peerId, device.flag, produce, forceTcp, displayName);

		this._signalingUrl = null;

		// Closed flag.
		this._closed = false;

		// Whether we should produce.
		this._produce = produce;

		// Whether we force TCP
		this._forceTcp = forceTcp;

		// URL basepath
		this._basePath = basePath;

		// Use displayName
		if (displayName)
			store.dispatch(settingsActions.setDisplayName(displayName));

		this._tracker = 'wss://tracker.lab.vvc.niif.hu:443';

		// Torrent support
		this._torrentSupport = null;

		// Whether simulcast should be used.
		this._useSimulcast = false;

		if ('simulcast' in window.config)
			this._useSimulcast = window.config.simulcast;

		// Whether simulcast should be used for sharing
		this._useSharingSimulcast = false;

		if ('simulcastSharing' in window.config)
			this._useSharingSimulcast = window.config.simulcastSharing;

		this._muted = muted;

		// This device
		this._device = device;

		// My peer name.
		this._peerId = peerId;

		// Access code
		this._accessCode = accessCode;

		// Alert sound
		this._soundAlert = new Audio('/resources/notify.mp3');

		// Socket.io peer connection
		this._signalingSocket = null;

		// The room ID
		this._roomId = null;

		// mediasoup-client Device instance.
		// @type {mediasoupClient.Device}
		this._mediasoupDevice = null;

		// Put the browser info into state
		store.dispatch(meActions.setBrowser(device));

		// Our WebTorrent client
		this._webTorrent = null;

		// Max spotlights
		if (device.platform === 'desktop')
			this._maxSpotlights = lastN;
		else
			this._maxSpotlights = mobileLastN;

		store.dispatch(
			settingsActions.setLastN(this._maxSpotlights));

		// Manager of spotlight
		this._spotlights = null;

		// Transport for sending.
		this._sendTransport = null;

		// Transport for receiving.
		this._recvTransport = null;

		// Local mic mediasoup Producer.
		this._micProducer = null;

		// Local mic hark
		this._hark = null;

		// Local MediaStream for hark
		this._harkStream = null;

		// Local webcam mediasoup Producer.
		this._webcamProducer = null;

		// Extra videos being produced
		this._extraVideoProducers = new Map();

		// Map of webcam MediaDeviceInfos indexed by deviceId.
		// @type {Map<String, MediaDeviceInfos>}
		this._webcams = {};

		this._audioDevices = {};

		this._audioOutputDevices = {};

		// mediasoup Consumers.
		// @type {Map<String, mediasoupClient.Consumer>}
		this._consumers = new Map();

		this._screenSharing = null;

		this._screenSharingProducer = null;

		this._startKeyListener();

		this._startDevicesListener();
	}



	close(windowClose)
	{
		if (this._closed)
			return;

		this._closed = true;

		logger.debug('close()');

		this._signalingSocket.close();

		// Close mediasoup Transports.
		if (this._sendTransport)
			this._sendTransport.close();

		if (this._recvTransport)
			this._recvTransport.close();

		store.dispatch(roomActions.setRoomState('closed'));
		if(windowClose){
			window.history.back(); 
		}
		
		//window.history.pushState('', '', window.URL_PARSER.toString());
	}

	_startKeyListener()
	{
		// Add keydown event listener on document
		document.addEventListener('keydown', (event) =>
		{
			if (event.repeat) return;
			const key = String.fromCharCode(event.which);

			const source = event.target;

			const exclude = [ 'input', 'textarea' ];

			if (exclude.indexOf(source.tagName.toLowerCase()) === -1)
			{
				logger.debug('keyDown() [key:"%s"]', key);

				switch (key)
				{
					case String.fromCharCode(37):
					{
						const newPeerId = this._spotlights.getPrevAsSelected(
							store.getState().room.selectedPeerId);

						if (newPeerId) this.setSelectedPeer(newPeerId);
						break;
					}
					case String.fromCharCode(39):
					{
						const newPeerId = this._spotlights.getNextAsSelected(
							store.getState().room.selectedPeerId);

						if (newPeerId) this.setSelectedPeer(newPeerId);
						break;
					}
					case 'A': // Activate advanced mode
					{
						store.dispatch(settingsActions.toggleAdvancedMode());
						store.dispatch(requestActions.notify(
							{
								text : 'Toggled advanced mode'
							}));
						break;
					}

					case '1': // Set democratic view
					{
						store.dispatch(roomActions.setDisplayMode('democratic'));
						store.dispatch(requestActions.notify(
							{
								text : 'Changed layout to democratic view'
							}));
						break;
					}

					case '2': // Set filmstrip view
					{
						store.dispatch(roomActions.setDisplayMode('filmstrip'));
						store.dispatch(requestActions.notify(
							{
								text : 'Changed layout to filmstrip view'
							}));
						break;
					}

					case ' ': // Push To Talk start
					{
						if (this._micProducer)
						{
							if (this._micProducer.paused)
							{
								this.unmuteMic();
							}
						}

						break;
					}
					case 'M': // Toggle microphone
					{
						if (this._micProducer)
						{
							if (!this._micProducer.paused)
							{
								this.muteMic();

								store.dispatch(requestActions.notify(
									{
										text :  'Muted your microphone'
									}));
							}
							else
							{
								this.unmuteMic();

								store.dispatch(requestActions.notify(
									{
										text : 'Unmuted your microphone'
									}));
							}
						}
						else
						{
							this.updateMic({ start: true });

							store.dispatch(requestActions.notify(
								{
									text : 'Enabled your microphone'
								}));
						}

						break;
					}

					case 'V': // Toggle video
					{
						if (this._webcamProducer)
							this.disableWebcam();
						else
							this.updateWebcam({ start: true });

						break;
					}
			
					default:
					{
						break;
					}
				}
			}
		});
		document.addEventListener('keyup', (event) =>
		{
			const key = String.fromCharCode(event.which);

			const source = event.target;

			const exclude = [ 'input', 'textarea' ];

			if (exclude.indexOf(source.tagName.toLowerCase()) === -1)
			{
				logger.debug('keyUp() [key:"%s"]', key);

				switch (key)
				{
					case ' ': // Push To Talk stop
					{
						if (this._micProducer)
						{
							if (!this._micProducer.paused)
							{
								this.muteMic();
							}
						}

						break;
					}
					default:
					{
						break;
					}
				}
			}
			event.preventDefault();
		}, true);

	}

	_startDevicesListener()
	{
		navigator.mediaDevices.addEventListener('devicechange', async () =>
		{
			logger.debug('_startDevicesListener() | navigator.mediaDevices.ondevicechange');

			await this._updateAudioDevices();
			await this._updateWebcams();
			await this._updateAudioOutputDevices();

			store.dispatch(requestActions.notify(
				{
					text : 'Your devices changed, configure your devices in the settings dialog'
				}));
		});
	}
 
 
	_soundNotification()
	{
		const { notificationSounds } = store.getState().settings;

		if (notificationSounds)
		{
			const alertPromise = this._soundAlert.play();

			if (alertPromise !== undefined)
			{
				alertPromise
					.then()
					.catch((error) =>
					{
						logger.error('_soundAlert.play() [error:"%o"]', error);
					});
			}
		}
	}

	timeoutCallback(callback)
	{
		let called = false;

		const interval = setTimeout(
			() =>
			{
				if (called)
					return;
				called = true;
				callback(new SocketTimeoutError('Request timed out'));
			},
			ROOM_OPTIONS.requestTimeout
		);

		return (...args) =>
		{
			if (called)
				return;
			called = true;
			clearTimeout(interval);

			callback(...args);
		};
	}

	_sendRequest(method, data)
	{
		return new Promise((resolve, reject) =>
		{
			if (!this._signalingSocket)
			{
				reject('No socket connection');
			}
			else
			{
				this._signalingSocket.emit(
					'request',
					{ method, data },
					this.timeoutCallback((err, response) =>
					{
						if (err)
							reject(err);
						else
							resolve(response);
					})
				);
			}
		});
	}

	_getWebcamType(device)
	{
		if (/(back|rear)/i.test(device.label))
		{
			logger.debug('_getWebcamType() | it seems to be a back camera');

			return 'back';
		}
		else
		{
			logger.debug('_getWebcamType() | it seems to be a front camera');

			return 'front';
		}
	}

	async getTransportStats()
	{
		try
		{
			if (this._recvTransport)
			{
				logger.debug('getTransportStats() - recv [transportId: "%s"]', this._recvTransport.id);

				const recv = await this.sendRequest('getTransportStats', { transportId: this._recvTransport.id });

				store.dispatch(
					transportActions.addTransportStats(recv, 'recv'));
			}

			if (this._sendTransport)
			{
				logger.debug('getTransportStats() - send [transportId: "%s"]', this._sendTransport.id);

				const send = await this.sendRequest('getTransportStats', { transportId: this._sendTransport.id });

				store.dispatch(
					transportActions.addTransportStats(send, 'send'));
			}
		}
		catch (error)
		{
			logger.error('getTransportStats() [error:"%o"]', error);
		}
	}

	async sendRequest(method, data)
	{
		logger.debug('sendRequest() [method:"%s", data:"%o"]', method, data);

		const {
			requestRetries = 3
		} = window.config;

		for (let tries = 0; tries < requestRetries; tries++)
		{
			try
			{
				return await this._sendRequest(method, data);
			}
			catch (error)
			{
				if (
					error instanceof SocketTimeoutError &&
					tries < requestRetries
				)
					logger.warn('sendRequest() | timeout, retrying [attempt:"%s"]', tries);
				else
					throw error;
			}
		}
	}

	async changeDisplayName(displayName)
	{
		logger.debug('changeDisplayName() [displayName:"%s"]', displayName);

		if (!displayName)
			displayName = 'Guest';

		store.dispatch(
			meActions.setDisplayNameInProgress(true));

		try
		{
			await this.sendRequest('changeDisplayName', { displayName });

			store.dispatch(settingsActions.setDisplayName(displayName));

			let message ='Your display name changed to ' + displayName

			store.dispatch(requestActions.notify(
				{
					text : message
				}));
			cookiesManager.setUser(displayName);
		}
		catch (error)
		{
			logger.error('changeDisplayName() [error:"%o"]', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : 'An error occurred while changing your display name'
				}));
		}

		store.dispatch(
			meActions.setDisplayNameInProgress(false));
	}

	async changePicture(picture)
	{
		logger.debug('changePicture() [picture: "%s"]', picture);

		try
		{
			await this.sendRequest('changePicture', { picture });
		}
		catch (error)
		{
			logger.error('changePicture() [error:"%o"]', error);
		}
	}

	async sendChatMessage(chatMessage)
	{
		logger.debug('sendChatMessage() [chatMessage:"%s"]', chatMessage);

		try
		{
			store.dispatch(
				chatActions.addUserMessage(chatMessage.text));

			await this.sendRequest('chatMessage', { chatMessage });
		}
		catch (error)
		{
			logger.error('sendChatMessage() [error:"%o"]', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text :  'Unable to send chat message'
				}));
		}
	}

	saveFile(file)
	{
		file.getBlob((err, blob) =>
		{
			if (err)
			{
				store.dispatch(requestActions.notify(
					{
						type : 'error',
						text : 'Unable to save file'
					}));

				return;
			}

			saveAs(blob, file.name);
		});
	}

	handleDownload(magnetUri)
	{
		store.dispatch(
			fileActions.setFileActive(magnetUri));

		const existingTorrent = this._webTorrent.get(magnetUri);

		if (existingTorrent)
		{
			// Never add duplicate torrents, use the existing one instead.
			this._handleTorrent(existingTorrent);

			return;
		}

		this._webTorrent.add(magnetUri, this._handleTorrent);
	}

	_handleTorrent(torrent)
	{
		// Torrent already done, this can happen if the
		// same file was sent multiple times.
		if (torrent.progress === 1)
		{
			store.dispatch(
				fileActions.setFileDone(
					torrent.magnetURI,
					torrent.files
				));

			return;
		}

		let lastMove = 0;

		torrent.on('download', () =>
		{
			if (Date.now() - lastMove > 1000)
			{
				store.dispatch(
					fileActions.setFileProgress(
						torrent.magnetURI,
						torrent.progress
					));

				lastMove = Date.now();
			}
		});

		torrent.on('done', () =>
		{
			store.dispatch(
				fileActions.setFileDone(
					torrent.magnetURI,
					torrent.files
				));
		});
	}

	async shareFiles(files)
	{
		store.dispatch(requestActions.notify(
			{
				text : 'Attempting to share file'
			}));

		createTorrent(files, (err, torrent) =>
		{
			if (err)
			{
				store.dispatch(requestActions.notify(
					{
						type : 'error',
						text :  'Unable to share file'
					}));

				return;
			}

			const existingTorrent = this._webTorrent.get(torrent);

			if (existingTorrent)
			{
				store.dispatch(requestActions.notify(
					{
						text : 'File successfully shared'
					}));

				store.dispatch(fileActions.addFile(
					this._peerId,
					existingTorrent.magnetURI
				));

				this._sendFile(existingTorrent.magnetURI);

				return;
			}

			this._webTorrent.seed(
				files,
				{ announceList: [ [ this._tracker ] ] },
				(newTorrent) =>
				{
					store.dispatch(requestActions.notify(
						{
							text : 'File successfully shared'
						}));

					store.dispatch(fileActions.addFile(
						this._peerId,
						newTorrent.magnetURI
					));

					this._sendFile(newTorrent.magnetURI);
				});
		});
	}

	// { file, name, picture }
	async _sendFile(magnetUri)
	{
		logger.debug('sendFile() [magnetUri:"%o"]', magnetUri);

		try
		{
			await this.sendRequest('sendFile', { magnetUri });
		}
		catch (error)
		{
			logger.error('sendFile() [error:"%o"]', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : 'Unable to share file'
				}));
		}
	}

	async muteMic()
	{
		logger.debug('muteMic()');
		if(this._micProducer){
			this._micProducer.pause();

			try
			{
				await this.sendRequest(
					'pauseProducer', { producerId: this._micProducer.id });
	
				store.dispatch(
					producerActions.setProducerPaused(this._micProducer.id));
			}
			catch (error)
			{
				logger.error('muteMic() [error:"%o"]', error);
	
				store.dispatch(requestActions.notify(
					{
						type : 'error',
						text :  'Unable to mute your microphone'
					}));
			}
		}
	
	}

	async unmuteMic()
	{
		logger.debug('unmuteMic()');

		if (!this._micProducer)
		{
			this.updateMic({ start: true });
		}
		else
		{
			this._micProducer.resume();

			try
			{
				await this.sendRequest(
					'resumeProducer', { producerId: this._micProducer.id });

				store.dispatch(
					producerActions.setProducerResumed(this._micProducer.id));
			}
			catch (error)
			{
				logger.error('unmuteMic() [error:"%o"]', error);

				store.dispatch(requestActions.notify(
					{
						type : 'error',
						text :'Unable to unmute your microphone'
					}));
			}
		}
	}

	changeMaxSpotlights(maxSpotlights)
	{
		this._spotlights.maxSpotlights = maxSpotlights;

		store.dispatch(
			settingsActions.setLastN(maxSpotlights));
	}

	// Updated consumers based on spotlights
	async updateSpotlights(spotlights)
	{
		logger.debug('updateSpotlights()');

		try
		{
			for (const consumer of this._consumers.values())
			{
				if (consumer.kind === 'video')
				{
					if (spotlights.includes(consumer.appData.peerId))
						await this._resumeConsumer(consumer);
					else
						await this._pauseConsumer(consumer);
				}
			}
		}
		catch (error)
		{
			logger.error('updateSpotlights() [error:"%o"]', error);
		}
	}

	disconnectLocalHark()
	{
		logger.debug('disconnectLocalHark()');

		if (this._harkStream != null)
		{
			let [ track ] = this._harkStream.getAudioTracks();

			track.stop();
			track = null;

			this._harkStream = null;
		}

		if (this._hark != null)
			this._hark.stop();
	}

	connectLocalHark(track)
	{
		logger.debug('connectLocalHark() [track:"%o"]', track);

		this._harkStream = new MediaStream();

		const newTrack = track.clone();

		this._harkStream.addTrack(newTrack);

		newTrack.enabled = true;

		this._hark = hark(this._harkStream,
			{
				play      : false,
				interval  : 10,
				threshold : store.getState().settings.noiseThreshold,
				history   : 100
			});

		this._hark.lastVolume = -100;

		this._hark.on('volume_change', (volume) =>
		{
			volume = Math.round(volume);

			if (this._micProducer && (volume !== Math.round(this._hark.lastVolume)))
			{
				if (volume < this._hark.lastVolume)
				{
					volume =
						this._hark.lastVolume -
						Math.pow(
							(volume - this._hark.lastVolume) /
							(100 + this._hark.lastVolume)
							, 4
						) * 2;
				}

				this._hark.lastVolume = volume;

				store.dispatch(peerVolumeActions.setPeerVolume(this._peerId, volume));
			}
		});

		this._hark.on('speaking', () =>
		{
			store.dispatch(meActions.setIsSpeaking(true));

			if (
				(store.getState().settings.voiceActivatedUnmute ||
				store.getState().me.isAutoMuted) &&
				this._micProducer &&
				this._micProducer.paused
			)
				this._micProducer.resume();

			store.dispatch(meActions.setAutoMuted(false)); // sanity action
		});

		this._hark.on('stopped_speaking', () =>
		{
			store.dispatch(meActions.setIsSpeaking(false));

			if (
				store.getState().settings.voiceActivatedUnmute &&
				this._micProducer &&
				!this._micProducer.paused
			)
			{
				this._micProducer.pause();

				store.dispatch(meActions.setAutoMuted(true));
			}
		});
	}

	async changeAudioOutputDevice(deviceId)
	{
		logger.debug('changeAudioOutputDevice() [deviceId:"%s"]', deviceId);

		store.dispatch(
			meActions.setAudioOutputInProgress(true));

		try
		{
			const device = this._audioOutputDevices[deviceId];

			if (!device)
				throw new Error('Selected audio output device no longer available');

			store.dispatch(settingsActions.setSelectedAudioOutputDevice(deviceId));

			await this._updateAudioOutputDevices();
		}
		catch (error)
		{
			logger.error('changeAudioOutputDevice() [error:"%o"]', error);
		}

		store.dispatch(
			meActions.setAudioOutputInProgress(false));
	}

	async updateMic({ start = false, restart = false, newDeviceId = null } = {})
	{
		logger.debug(
			'updateMic() [start:"%s", restart:"%s", newDeviceId:"%s"]',
			start,
			restart,
			newDeviceId
		);

		let track;

		try
		{
			if (!this._mediasoupDevice.canProduce('audio'))
				throw new Error('cannot produce audio');

			if (newDeviceId && !restart)
				throw new Error('changing device requires restart');

			if (newDeviceId)
				store.dispatch(settingsActions.setSelectedAudioDevice(newDeviceId));

			store.dispatch(meActions.setAudioInProgress(true));

			const deviceId = await this._getAudioDeviceId();
			const device = this._audioDevices[deviceId];

			if (!device)
				throw new Error('no audio devices');

			const {
				sampleRate,
				channelCount,
				volume,
				autoGainControl,
				echoCancellation,
				noiseSuppression,
				sampleSize
			} = store.getState().settings;

			if (
				(restart && this._micProducer) ||
				start
			)
			{
				this.disconnectLocalHark();

				if (this._micProducer)
					await this.disableMic();

				const stream = await navigator.mediaDevices.getUserMedia(
					{
						audio : {
							deviceId : { ideal: deviceId },
							sampleRate,
							channelCount,
							volume,
							autoGainControl,
							echoCancellation,
							noiseSuppression,
							sampleSize
						}
					}
				);

				([ track ] = stream.getAudioTracks());

				const { deviceId: trackDeviceId } = track.getSettings();

				store.dispatch(settingsActions.setSelectedAudioDevice(trackDeviceId));

				this._micProducer = await this._sendTransport.produce(
					{
						track,
						codecOptions :
						{
							opusStereo          : false,
							opusDtx             : true,
							opusFec             : true,
							opusPtime           : '3',
							opusMaxPlaybackRate	: 48000
						},
						appData :
						{ source: 'mic' }
					});

				store.dispatch(producerActions.addProducer(
					{
						id            : this._micProducer.id,
						source        : 'mic',
						paused        : this._micProducer.paused,
						track         : this._micProducer.track,
						rtpParameters : this._micProducer.rtpParameters,
						codec         : this._micProducer.rtpParameters.codecs[0].mimeType.split('/')[1]
					}));

				this._micProducer.on('transportclose', () =>
				{
					this._micProducer = null;
				});

				this._micProducer.on('trackended', () =>
				{
					store.dispatch(requestActions.notify(
						{
							type : 'error',
							text :  'Microphone disconnected'
						}));

					this.disableMic();
				});

				this._micProducer.volume = 0;

				this.connectLocalHark(track);
			}
			else if (this._micProducer)
			{
				({ track } = this._micProducer);

				await track.applyConstraints(
					{
						sampleRate,
						channelCount,
						volume,
						autoGainControl,
						echoCancellation,
						noiseSuppression,
						sampleSize
					}
				);

				if (this._harkStream != null)
				{
					const [ harkTrack ] = this._harkStream.getAudioTracks();

					harkTrack && await harkTrack.applyConstraints(
						{
							sampleRate,
							channelCount,
							volume,
							autoGainControl,
							echoCancellation,
							noiseSuppression,
							sampleSize
						}
					);
				}
			}
		}
		catch (error)
		{
			logger.error('updateMic() [error:"%o"]', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : 'An error occurred while accessing your microphone'
				}));

			if (track)
				track.stop();
		}

		store.dispatch(meActions.setAudioInProgress(false));
	}

	async enableAudioOnly()
	{
		logger.debug('enableAudioOnly()');

		store.dispatch(
			stateActions.setAudioOnlyInProgress(true));

		this.disableWebcam();

		for (const consumer of this._consumers.values())
		{
			if (consumer.kind !== 'video')
				continue;

			this._pauseConsumer(consumer);
		}

		store.dispatch(
			stateActions.setAudioOnlyState(true));

		store.dispatch(
			stateActions.setAudioOnlyInProgress(false));
	}

	async disableAudioOnly()
	{
		logger.debug('disableAudioOnly()');

		store.dispatch(
			stateActions.setAudioOnlyInProgress(true));

		if (
			!this._webcamProducer &&
			this._produce  
		)
		{
			this.enableWebcam();
		}

		for (const consumer of this._consumers.values())
		{
			if (consumer.kind !== 'video')
				continue;

			this._resumeConsumer(consumer);
		}

		store.dispatch(
			stateActions.setAudioOnlyState(false));

		store.dispatch(
			stateActions.setAudioOnlyInProgress(false));
	}

	async muteAudio()
	{
		logger.debug('muteAudio()');

		store.dispatch(
			stateActions.setAudioMutedState(true));
	}

	async unmuteAudio()
	{
		logger.debug('unmuteAudio()');

		store.dispatch(
			stateActions.setAudioMutedState(false));
	}


	async enableShare()
	{
		logger.debug('enableShare()');

		if (this._shareProducer)
			return;
		else if (this._webcamProducer)
		//	await this.disableWebcam();

		if (!this._mediasoupDevice.canProduce('video'))
		{
			logger.error('enableShare() | cannot produce video');

			return;
		}

		let track;

		store.dispatch(
			stateActions.setShareInProgress(true));

		try
		{
			logger.debug('enableShare() | calling getUserMedia()');

			const stream = await navigator.mediaDevices.getDisplayMedia(
				{
					audio : false,
					video :
					{
						displaySurface : 'monitor',
						logicalSurface : true,
						cursor         : true,
						width          : { max: 1920 },
						height         : { max: 1080 },
						frameRate      : { max: 30 }
					}
				});

			// May mean cancelled (in some implementations).
			if (!stream)
			{
				store.dispatch(
					stateActions.setShareInProgress(true));

				return;
			}

			track = stream.getVideoTracks()[0];

			let encodings;
			let codec;
			const codecOptions =
			{
				videoGoogleStartBitrate : 1000
			};

			if (this._forceH264)
			{
				codec = this._mediasoupDevice.rtpCapabilities.codecs
					.find((c) => c.mimeType.toLowerCase() === 'video/h264');

				if (!codec)
				{
					throw new Error('desired H264 codec+configuration is not supported');
				}
			}
			else if (this._forceVP9)
			{
				codec = this._mediasoupDevice.rtpCapabilities.codecs
					.find((c) => c.mimeType.toLowerCase() === 'video/vp9');

				if (!codec)
				{
					throw new Error('desired VP9 codec+configuration is not supported');
				}
			}

			if (this._useSharingSimulcast)
			{
				// If VP9 is the only available video codec then use SVC.
				const firstVideoCodec = this._mediasoupDevice
					.rtpCapabilities
					.codecs
					.find((c) => c.kind === 'video');

				if (
					(this._forceVP9 && codec) ||
					firstVideoCodec.mimeType.toLowerCase() === 'video/vp9'
				)
				{
					encodings = VIDEO_SVC_ENCODINGS;
				}
				else
				{
					encodings = VIDEO_SIMULCAST_ENCODINGS
						.map((encoding) => ({ ...encoding, dtx: true }));
				}
			}

			this._shareProducer = await this._sendTransport.produce(
				{
					track,
					encodings,
					codecOptions,
					codec,
					appData :
					{
						source:"share",
						share : true
					}
				});

			store.dispatch(stateActions.addProducer(
				{
					id            : this._shareProducer.id,
					type          : 'share',
					paused        : this._shareProducer.paused,
					track         : this._shareProducer.track,
					rtpParameters : this._shareProducer.rtpParameters,
					codec         : this._shareProducer.rtpParameters.codecs[0].mimeType.split('/')[1]
				}));

			this._shareProducer.on('transportclose', () =>
			{
				this._shareProducer = null;
			});

			this._shareProducer.on('trackended', () =>
			{
				store.dispatch(requestActions.notify(
					{
						type : 'error',
						text : 'Share disconnected!'
					}));

				this.disableShare()
					.catch(() => {});
			});
		}
		catch (error)
		{
			logger.error('enableShare() | failed:%o', error);

			if (error.name !== 'NotAllowedError')
			{
				store.dispatch(requestActions.notify(
					{
						type : 'error',
						text : `Error sharing: ${error}`
					}));
			}

			if (track)
				track.stop();
		}

		store.dispatch(
			stateActions.setShareInProgress(false));
	}

	async disableShare()
	{
		logger.debug('disableShare()');

		if (!this._shareProducer)
			return;

		this._shareProducer.close();

		store.dispatch(
			stateActions.removeProducer(this._shareProducer.id));

		try
		{
			await this.sendRequest(
				'closeProducer', { producerId: this._shareProducer.id });
		}
		catch (error)
		{
			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Error closing server-side share Producer: ${error}`
				}));
		}

		this._shareProducer = null;
	}


	

	async updateWebcam({
		start = false,
		restart = false,
		newDeviceId = null,
		newResolution = null,
		newFrameRate = null
	} = {})
	{
		logger.debug(
			'updateWebcam() [start:"%s", restart:"%s", newDeviceId:"%s", newResolution:"%s", newFrameRate:"%s"]',
			start,
			restart,
			newDeviceId,
			newResolution,
			newFrameRate
		);

		let track;

		try
		{
			if (!this._mediasoupDevice.canProduce('video'))
				throw new Error('cannot produce video');

			if (newDeviceId && !restart)
				throw new Error('changing device requires restart');

			if (newDeviceId)
				store.dispatch(settingsActions.setSelectedWebcamDevice(newDeviceId));

			if (newResolution)
				store.dispatch(settingsActions.setVideoResolution(newResolution));

			if (newFrameRate)
				store.dispatch(settingsActions.setVideoFrameRate(newFrameRate));

			store.dispatch(meActions.setWebcamInProgress(true));

			const deviceId = await this._getWebcamDeviceId();
			const device = this._webcams[deviceId];

			if (!device)
				throw new Error('no webcam devices');

			const {
				resolution,
				frameRate
			} = store.getState().settings;

			if (
				(restart && this._webcamProducer) ||
				start
			)
			{
				if (this._webcamProducer)
					await this.disableWebcam();

				const stream = await navigator.mediaDevices.getUserMedia(
					{
						video :
						{
							deviceId : { ideal: deviceId },
							...VIDEO_CONSTRAINS[resolution],
							frameRate
						}
					});

				([ track ] = stream.getVideoTracks());

				const { deviceId: trackDeviceId } = track.getSettings();

				store.dispatch(settingsActions.setSelectedWebcamDevice(trackDeviceId));

				if (this._useSimulcast)
				{
					// If VP9 is the only available video codec then use SVC.
					const firstVideoCodec = this._mediasoupDevice
						.rtpCapabilities
						.codecs
						.find((c) => c.kind === 'video');

					let encodings;

					if (firstVideoCodec.mimeType.toLowerCase() === 'video/vp9')
						encodings = VIDEO_KSVC_ENCODINGS;
					else if ('simulcastEncodings' in window.config)
						encodings = window.config.simulcastEncodings;
					else
						encodings = VIDEO_SIMULCAST_ENCODINGS;

					this._webcamProducer = await this._sendTransport.produce(
						{
							track,
							encodings,
							codecOptions :
							{
								videoGoogleStartBitrate : 1000
							},
							appData :
							{
								source : 'webcam'
							}
						});
				}
				else
				{
					this._webcamProducer = await this._sendTransport.produce({
						track,
						appData :
						{
							source : 'webcam'
						}
					});
				}

				store.dispatch(producerActions.addProducer(
					{
						id            : this._webcamProducer.id,
						source        : 'webcam',
						paused        : this._webcamProducer.paused,
						track         : this._webcamProducer.track,
						rtpParameters : this._webcamProducer.rtpParameters,
						codec         : this._webcamProducer.rtpParameters.codecs[0].mimeType.split('/')[1]
					}));

				this._webcamProducer.on('transportclose', () =>
				{
					this._webcamProducer = null;
				});

				this._webcamProducer.on('trackended', () =>
				{
					store.dispatch(requestActions.notify(
						{
							type : 'error',
							text : 'Camera disconnected'
						}));

					this.disableWebcam();
				});
			}
			else if (this._webcamProducer)
			{
				({ track } = this._webcamProducer);

				await track.applyConstraints(
					{
						...VIDEO_CONSTRAINS[resolution],
						frameRate
					}
				);

				// Also change resolution of extra video producers
				for (const producer of this._extraVideoProducers.values())
				{
					({ track } = producer);

					await track.applyConstraints(
						{
							...VIDEO_CONSTRAINS[resolution],
							frameRate
						}
					);
				}
			}
		}
		catch (error)
		{
			logger.error('updateWebcam() [error:"%o"]', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : 'An error occurred while accessing your camera'
				}));

			if (track)
				track.stop();
		}

		store.dispatch(
			meActions.setWebcamInProgress(false));
	}

	async enableWebcam()
	{
		logger.debug('enableWebcam()');

		if (this._webcamProducer)
			return;
		else if (this._shareProducer)
		//	await this.disableShare();

		if (!this._mediasoupDevice.canProduce('video'))
		{
			logger.error('enableWebcam() | cannot produce video');

			return;
		}

		let track;
		

		store.dispatch(
			stateActions.setWebcamInProgress(true));

		try
		{
			let device ;
			if (!this._externalVideo)
			{
				await this._updateWebcams();
				const deviceId = await this._getWebcamDeviceId();
				device = this._webcams[deviceId];

				 

				if (!device)
					throw new Error('no webcam devices');

				logger.debug('enableWebcam() | calling getUserMedia()');

				const stream = await navigator.mediaDevices.getUserMedia(
					{
						video :
						{
							deviceId : { ideal: device.deviceId },
							...VIDEO_CONSTRAINS[store.getState().settings.resolution]
						}
					});

				track = stream.getVideoTracks()[0];
			}
			else
			{
				device = { label: 'external video' };

				const stream = await this._getExternalVideoStream();

				track = stream.getVideoTracks()[0].clone();
			}

			let encodings;
			let codec;
			const codecOptions =
			{
				videoGoogleStartBitrate : 1000
			};

			if (this._forceH264)
			{
				codec = this._mediasoupDevice.rtpCapabilities.codecs
					.find((c) => c.mimeType.toLowerCase() === 'video/h264');

				if (!codec)
				{
					throw new Error('desired H264 codec+configuration is not supported');
				}
			}
			else if (this._forceVP9)
			{
				codec = this._mediasoupDevice.rtpCapabilities.codecs
					.find((c) => c.mimeType.toLowerCase() === 'video/vp9');

				if (!codec)
				{
					throw new Error('desired VP9 codec+configuration is not supported');
				}
			}

			if (this._useSimulcast)
			{
				// If VP9 is the only available video codec then use SVC.
				const firstVideoCodec = this._mediasoupDevice
					.rtpCapabilities
					.codecs
					.find((c) => c.kind === 'video');

				if (
					(this._forceVP9 && codec) ||
					firstVideoCodec.mimeType.toLowerCase() === 'video/vp9'
				)
				{
					encodings = VIDEO_KSVC_ENCODINGS;
				}
				else
				{
					encodings = VIDEO_SIMULCAST_ENCODINGS;
				}
			}

			this._webcamProducer = await this._sendTransport.produce(
				{
					track,
					encodings,
					codecOptions,
					codec
				});

			store.dispatch(stateActions.addProducer(
				{
					id            : this._webcamProducer.id,
					deviceLabel   : device.label,
					type          : this._getWebcamType(device),
					paused        : this._webcamProducer.paused,
					track         : this._webcamProducer.track,
					rtpParameters : this._webcamProducer.rtpParameters,
					codec         : this._webcamProducer.rtpParameters.codecs[0].mimeType.split('/')[1]
				}));

			this._webcamProducer.on('transportclose', () =>
			{
				this._webcamProducer = null;
			});

			this._webcamProducer.on('trackended', () =>
			{
				store.dispatch(requestActions.notify(
					{
						type : 'error',
						text : 'Webcam disconnected!'
					}));

				this.disableWebcam()
					.catch(() => {});
			});
		}
		catch (error)
		{
			logger.error('enableWebcam() | failed:%o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Error enabling webcam: ${error}`
				}));

			if (track)
				track.stop();
		}

		store.dispatch(
			stateActions.setWebcamInProgress(false));
	}

	setSelectedPeer(peerId)
	{
		logger.debug('setSelectedPeer() [peerId:"%s"]', peerId);

		this._spotlights.setPeerSpotlight(peerId);

		store.dispatch(
			roomActions.setSelectedPeer(peerId));
	}

	async promoteAllLobbyPeers()
	{
		logger.debug('promoteAllLobbyPeers()');

		store.dispatch(
			roomActions.setLobbyPeersPromotionInProgress(true));

		try
		{
			await this.sendRequest('promoteAllPeers');
		}
		catch (error)
		{
			logger.error('promoteAllLobbyPeers() [error:"%o"]', error);
		}

		store.dispatch(
			roomActions.setLobbyPeersPromotionInProgress(false));
	}

	async promoteLobbyPeer(peerId)
	{
		logger.debug('promoteLobbyPeer() [peerId:"%s"]', peerId);

		store.dispatch(
			lobbyPeerActions.setLobbyPeerPromotionInProgress(peerId, true));

		try
		{
			await this.sendRequest('promotePeer', { peerId });
		}
		catch (error)
		{
			logger.error('promoteLobbyPeer() [error:"%o"]', error);
		}

		store.dispatch(
			lobbyPeerActions.setLobbyPeerPromotionInProgress(peerId, false));
	}

	async clearChat()
	{
		logger.debug('clearChat()');

		store.dispatch(
			roomActions.setClearChatInProgress(true));

		try
		{
			await this.sendRequest('moderator:clearChat');

			store.dispatch(chatActions.clearChat());
		}
		catch (error)
		{
			logger.error('clearChat() [error:"%o"]', error);
		}

		store.dispatch(
			roomActions.setClearChatInProgress(false));
	}

	async clearFileSharing()
	{
		logger.debug('clearFileSharing()');

		store.dispatch(
			roomActions.setClearFileSharingInProgress(true));

		try
		{
			await this.sendRequest('moderator:clearFileSharing');

			store.dispatch(fileActions.clearFiles());
		}
		catch (error)
		{
			logger.error('clearFileSharing() [error:"%o"]', error);
		}

		store.dispatch(
			roomActions.setClearFileSharingInProgress(false));
	}

	async kickPeer(peerId)
	{
		logger.debug('kickPeer() [peerId:"%s"]', peerId);

		store.dispatch(
			peerActions.setPeerKickInProgress(peerId, true));

		try
		{
			await this.sendRequest('moderator:kickPeer', { peerId });
		}
		catch (error)
		{
			logger.error('kickPeer() [error:"%o"]', error);
		}

		store.dispatch(
			peerActions.setPeerKickInProgress(peerId, false));
	}

	async mutePeer(peerId)
	{
		logger.debug('mutePeer() [peerId:"%s"]', peerId);

		store.dispatch(
			peerActions.setMutePeerInProgress(peerId, true));

		try
		{
			await this.sendRequest('moderator:mute', { peerId });
		}
		catch (error)
		{
			logger.error('mutePeer() [error:"%o"]', error);
		}

		store.dispatch(
			peerActions.setMutePeerInProgress(peerId, false));
	}

	async unmutePeer(peerId)
	{
		logger.debug('mutePeer() [peerId:"%s"]', peerId);

		store.dispatch(
			peerActions.setMutePeerInProgress(peerId, true));

		try
		{
			await this.sendRequest('moderator:unmute', { peerId });
		}
		catch (error)
		{
			logger.error('mutePeer() [error:"%o"]', error);
		}

		store.dispatch(
			peerActions.setMutePeerInProgress(peerId, false));
	}

	async stopPeerVideo(peerId)
	{
		logger.debug('stopPeerVideo() [peerId:"%s"]', peerId);

		store.dispatch(
			peerActions.setStopPeerVideoInProgress(peerId, true));

		try
		{
			await this.sendRequest('moderator:stopVideo', { peerId });
		}
		catch (error)
		{
			logger.error('stopPeerVideo() [error:"%o"]', error);
		}

		store.dispatch(
			peerActions.setStopPeerVideoInProgress(peerId, false));
	}

	async stopPeerScreenSharing(peerId)
	{
		logger.debug('stopPeerScreenSharing() [peerId:"%s"]', peerId);

		store.dispatch(
			peerActions.setStopPeerScreenSharingInProgress(peerId, true));

		try
		{
			await this.sendRequest('moderator:stopScreenSharing', { peerId });
		}
		catch (error)
		{
			logger.error('stopPeerScreenSharing() [error:"%o"]', error);
		}

		store.dispatch(
			peerActions.setStopPeerScreenSharingInProgress(peerId, false));
	}

	async muteAllPeers()
	{
		logger.debug('muteAllPeers()');

		store.dispatch(
			roomActions.setMuteAllInProgress(true));

		try
		{
			await this.sendRequest('moderator:muteAll');
		}
		catch (error)
		{
			logger.error('muteAllPeers() [error:"%o"]', error);
		}

		store.dispatch(
			roomActions.setAudioAllLocked(true));

		store.dispatch(
			roomActions.setMuteAllInProgress(false));
	}

	async unmuteAllPeers()
	{
		logger.debug('unmuteAllPeers()');

		store.dispatch(
			roomActions.setMuteAllInProgress(true));

		try
		{
			await this.sendRequest('moderator:unmuteAll');
		}
		catch (error)
		{
			logger.error('unmuteAllPeers() [error:"%o"]', error);
		}

		store.dispatch(
			roomActions.setAudioAllLocked(false));

		store.dispatch(
			roomActions.setMuteAllInProgress(false));
	}



	async stopAllPeerVideo()
	{
		logger.debug('stopAllPeerVideo()');

		store.dispatch(
			roomActions.setStopAllVideoInProgress(true));

		try
		{
			await this.sendRequest('moderator:stopAllVideo');
		}
		catch (error)
		{
			logger.error('stopAllPeerVideo() [error:"%o"]', error);
		}

		store.dispatch(
			roomActions.setVideoAllLocked(true));

		store.dispatch(
			roomActions.setStopAllVideoInProgress(false));
	}

	async playAllPeerVideo()
	{
		logger.debug('playAllPeerVideo()');

		store.dispatch(
			roomActions.setStopAllVideoInProgress(true));

		try
		{
			await this.sendRequest('moderator:playAllVideo');
		}
		catch (error)
		{
			logger.error('playAllPeerVideo() [error:"%o"]', error);
		}
		store.dispatch(
			roomActions.setVideoAllLocked(false));

		store.dispatch(
			roomActions.setStopAllVideoInProgress(false));
	}

	async stopAllPeerScreenSharing()
	{
		logger.debug('stopAllPeerScreenSharing()');

		store.dispatch(
			roomActions.setStopAllScreenSharingInProgress(true));

		try
		{
			await this.sendRequest('moderator:stopAllScreenSharing');
		}
		catch (error)
		{
			logger.error('stopAllPeerScreenSharing() [error:"%o"]', error);
		}

		store.dispatch(
			roomActions.setStopAllScreenSharingInProgress(false));
	}

	async closeMeeting()
	{
		logger.debug('closeMeeting()');

		store.dispatch(
			roomActions.setCloseMeetingInProgress(true));

		try
		{
			await this.sendRequest('moderator:closeMeeting');
			this.close(true)
		}
		catch (error)
		{
			logger.error('closeMeeting() [error:"%o"]', error);
		}

		store.dispatch(
			roomActions.setCloseMeetingInProgress(false));
	}

	async leaveMeeting()
	{
		logger.debug('leaveMeeting()');
		this.close(true)
		
	}

	// type: mic/webcam/screen
	// mute: true/false
	async modifyPeerConsumer(peerId, type, mute)
	{
		logger.debug(
			'modifyPeerConsumer() [peerId:"%s", type:"%s"]',
			peerId,
			type
		);

		if (type === 'mic')
			store.dispatch(
				peerActions.setPeerAudioInProgress(peerId, true));
		else if (type === 'webcam')
			store.dispatch(
				peerActions.setPeerVideoInProgress(peerId, true));
		else if (type === 'screen')
			store.dispatch(
				peerActions.setPeerScreenInProgress(peerId, true));

		try
		{
			for (const consumer of this._consumers.values())
			{
				if (consumer.appData.peerId === peerId && consumer.appData.source === type)
				{
					if (mute)
						await this._pauseConsumer(consumer);
					else
						await this._resumeConsumer(consumer);
				}
			}
		}
		catch (error)
		{
			logger.error('modifyPeerConsumer() [error:"%o"]', error);
		}

		if (type === 'mic')
			store.dispatch(
				peerActions.setPeerAudioInProgress(peerId, false));
		else if (type === 'webcam')
			store.dispatch(
				peerActions.setPeerVideoInProgress(peerId, false));
		else if (type === 'screen')
			store.dispatch(
				peerActions.setPeerScreenInProgress(peerId, false));
	}

	async _pauseConsumer(consumer)
	{
		logger.debug('_pauseConsumer() [consumer:"%o"]', consumer);

		if (consumer.paused || consumer.closed)
			return;

		try
		{
			await this.sendRequest('pauseConsumer', { consumerId: consumer.id });

			consumer.pause();

			store.dispatch(
				consumerActions.setConsumerPaused(consumer.id, 'local'));
		}
		catch (error)
		{
			logger.error('_pauseConsumer() [error:"%o"]', error);
		}
	}

	async _resumeConsumer(consumer)
	{
		logger.debug('_resumeConsumer() [consumer:"%o"]', consumer);

		if (!consumer.paused || consumer.closed)
			return;

		try
		{
			await this.sendRequest('resumeConsumer', { consumerId: consumer.id });

			consumer.resume();

			store.dispatch(
				consumerActions.setConsumerResumed(consumer.id, 'local'));
		}
		catch (error)
		{
			logger.error('_resumeConsumer() [error:"%o"]', error);
		}
	}

	async lowerPeerHand(peerId)
	{
		logger.debug('lowerPeerHand() [peerId:"%s"]', peerId);

		store.dispatch(
			peerActions.setPeerRaisedHandInProgress(peerId, true));

		try
		{
			await this.sendRequest('moderator:lowerHand', { peerId });
		}
		catch (error)
		{
			logger.error('lowerPeerHand() [error:"%o"]', error);
		}

		store.dispatch(
			peerActions.setPeerRaisedHandInProgress(peerId, false));
	}

	async setRaisedHand(raisedHand)
	{
		logger.debug('setRaisedHand: ', raisedHand);

		store.dispatch(
			meActions.setRaisedHandInProgress(true));

		try
		{
			await this.sendRequest('raisedHand', { raisedHand });

			store.dispatch(
				meActions.setRaisedHand(raisedHand));
		}
		catch (error)
		{
			logger.error('setRaisedHand() [error:"%o"]', error);

			// We need to refresh the component for it to render changed state
			store.dispatch(meActions.setRaisedHand(!raisedHand));
		}

		store.dispatch(
			meActions.setRaisedHandInProgress(false));
	}

	async setMaxSendingSpatialLayer(spatialLayer)
	{
		logger.debug('setMaxSendingSpatialLayer() [spatialLayer:"%s"]', spatialLayer);

		try
		{
			if (this._webcamProducer)
				await this._webcamProducer.setMaxSpatialLayer(spatialLayer);
			if (this._screenSharingProducer)
				await this._screenSharingProducer.setMaxSpatialLayer(spatialLayer);
		}
		catch (error)
		{
			logger.error('setMaxSendingSpatialLayer() [error:"%o"]', error);
		}
	}

	async setConsumerPreferredLayers(consumerId, spatialLayer, temporalLayer)
	{
		logger.debug(
			'setConsumerPreferredLayers() [consumerId:"%s", spatialLayer:"%s", temporalLayer:"%s"]',
			consumerId, spatialLayer, temporalLayer);

		try
		{
			await this.sendRequest(
				'setConsumerPreferedLayers', { consumerId, spatialLayer, temporalLayer });

			store.dispatch(consumerActions.setConsumerPreferredLayers(
				consumerId, spatialLayer, temporalLayer));
		}
		catch (error)
		{
			logger.error('setConsumerPreferredLayers() [error:"%o"]', error);
		}
	}

	async setConsumerPriority(consumerId, priority)
	{
		logger.debug(
			'setConsumerPriority() [consumerId:"%s", priority:%d]',
			consumerId, priority);

		try
		{
			await this.sendRequest('setConsumerPriority', { consumerId, priority });

			store.dispatch(consumerActions.setConsumerPriority(consumerId, priority));
		}
		catch (error)
		{
			logger.error('setConsumerPriority() [error:"%o"]', error);
		}
	}

	async requestConsumerKeyFrame(consumerId)
	{
		logger.debug('requestConsumerKeyFrame() [consumerId:"%s"]', consumerId);

		try
		{
			await this.sendRequest('requestConsumerKeyFrame', { consumerId });
		}
		catch (error)
		{
			logger.error('requestConsumerKeyFrame() [error:"%o"]', error);
		}
	}

	async _loadDynamicImports()
	{
		// ({ default: createTorrent } = await import(

		// 	/* webpackPrefetch: true */
		// 	/* webpackChunkName: "createtorrent" */
		// 	'create-torrent'
		// ));

		// ({ default: WebTorrent } = await import(

		// 	/* webpackPrefetch: true */
		// 	/* webpackChunkName: "webtorrent" */
		// 	'webtorrent'
		// ));

		({ default: saveAs } = await import(

			/* webpackPrefetch: true */
			/* webpackChunkName: "file-saver" */
			'file-saver'
		));

		({ default: ScreenShare } = await import(

			/* webpackPrefetch: true */
			/* webpackChunkName: "screensharing" */
			'./ScreenShare'
		));

		({ default: Spotlights } = await import(

			/* webpackPrefetch: true */
			/* webpackChunkName: "spotlights" */
			'./Spotlights'
		));

		mediasoupClient = await import(

			/* webpackPrefetch: true */
			/* webpackChunkName: "mediasoup" */
			'mediasoup-client'
		);

		({ default: io } = await import(

			/* webpackPrefetch: true */
			/* webpackChunkName: "socket.io" */
			'socket.io-client'
		));
	}

	async join({ roomId, joinVideo })
	{
		await this._loadDynamicImports();

		this._roomId = roomId;

		store.dispatch(roomActions.setRoomName(roomId));

		this._signalingUrl = getSignalingUrl(this._peerId, roomId);

		this._screenSharing = ScreenShare.create(this._device);

		this._signalingSocket = io(this._signalingUrl,{rejectUnauthorized:false});

		this._spotlights = new Spotlights(this._maxSpotlights, this._signalingSocket);

		store.dispatch(roomActions.setRoomState('connecting'));

		this._signalingSocket.on('connect', () =>
		{
			logger.debug('signaling Peer "connect" event');
		});

		this._signalingSocket.on('disconnect', (reason) =>
		{
			logger.warn('signaling Peer "disconnect" event [reason:"%s"]', reason);

			if (this._closed)
				return;

			if (reason === 'io server disconnect')
			{
				store.dispatch(requestActions.notify(
					{
						text :'You are disconnected'
					}));

				this.close();
			}

			store.dispatch(requestActions.notify(
				{
					text : 'You are disconnected, attempting to reconnect'
				}));

			if (this._screenSharingProducer)
			{
				this._screenSharingProducer.close();

				store.dispatch(
					producerActions.removeProducer(this._screenSharingProducer.id));

				this._screenSharingProducer = null;
			}

			if (this._webcamProducer)
			{
				this._webcamProducer.close();

				store.dispatch(
					producerActions.removeProducer(this._webcamProducer.id));

				this._webcamProducer = null;
			}

			if (this._micProducer)
			{
				this._micProducer.close();

				store.dispatch(
					producerActions.removeProducer(this._micProducer.id));

				this._micProducer = null;
			}

			if (this._sendTransport)
			{
				this._sendTransport.close();

				this._sendTransport = null;
			}

			if (this._recvTransport)
			{
				this._recvTransport.close();

				this._recvTransport = null;
			}

			this._spotlights.clearSpotlights();

			store.dispatch(peerActions.clearPeers());
			store.dispatch(consumerActions.clearConsumers());
			store.dispatch(roomActions.clearSpotlights());
			store.dispatch(roomActions.setRoomState('connecting'));
		});

		this._signalingSocket.on('reconnect_failed', () =>
		{
			logger.warn('signaling Peer "reconnect_failed" event');

			store.dispatch(requestActions.notify(
				{
					text : 'You are disconnected'
				}));

			this.close();
		});

		this._signalingSocket.on('reconnect', (attemptNumber) =>
		{
			logger.debug('signaling Peer "reconnect" event [attempts:"%s"]', attemptNumber);

			store.dispatch(requestActions.notify(
				{
					text : 'You are reconnected'
				}));

			store.dispatch(roomActions.setRoomState('connected'));
		});

		this._signalingSocket.on('request', async (request, cb) =>
		{
			logger.debug(
				'socket "request" event [method:"%s", data:"%o"]',
				request.method, request.data);

			switch (request.method)
			{
				case 'newConsumer':
				{
					const {
						peerId,
						producerId,
						id,
						kind,
						rtpParameters,
						type,
						appData,
						producerPaused
					} = request.data;

					const consumer = await this._recvTransport.consume(
						{
							id,
							producerId,
							kind,
							rtpParameters,
							appData : { ...appData, peerId } // Trick.
						});

					// Store in the map.
					this._consumers.set(consumer.id, consumer);

					consumer.on('transportclose', () =>
					{
						this._consumers.delete(consumer.id);
					});

					const { spatialLayers, temporalLayers } =
						mediasoupClient.parseScalabilityMode(
							consumer.rtpParameters.encodings[0].scalabilityMode);

					store.dispatch(consumerActions.addConsumer(
						{
							id                     : consumer.id,
							peerId                 : peerId,
							kind                   : kind,
							type                   : type,
							locallyPaused          : false,
							remotelyPaused         : producerPaused,
							rtpParameters          : consumer.rtpParameters,
							source                 : consumer.appData.source,
							spatialLayers          : spatialLayers,
							temporalLayers         : temporalLayers,
							preferredSpatialLayer  : spatialLayers - 1,
							preferredTemporalLayer : temporalLayers - 1,
							priority               : 1,
							codec                  : consumer.rtpParameters.codecs[0].mimeType.split('/')[1],
							track                  : consumer.track
						},
						peerId));

					// We are ready. Answer the request so the server will
					// resume this Consumer (which was paused for now).
					cb(null);

					if (kind === 'audio')
					{
						consumer.volume = 0;

						const stream = new MediaStream();

						stream.addTrack(consumer.track);

						if (!stream.getAudioTracks()[0])
							throw new Error('request.newConsumer | given stream has no audio track');

						consumer.hark = hark(stream, { play: false });

						consumer.hark.on('volume_change', (volume) =>
						{
							volume = Math.round(volume);

							if (consumer && volume !== consumer.volume)
							{
								consumer.volume = volume;

								store.dispatch(peerVolumeActions.setPeerVolume(peerId, volume));
							}
						});
					}

					break;
				}

				default:
				{
					logger.error('unknown request.method "%s"', request.method);

					cb(500, `unknown request.method "${request.method}"`);
				}
			}
		});

		this._signalingSocket.on('notification', async (notification) =>
		{
			logger.debug(
				'socket "notification" event [method:"%s", data:"%o"]',
				notification.method, notification.data);

			try
			{
				switch (notification.method)
				{

					case 'enteredLobby':
					{
						store.dispatch(roomActions.setInLobby(true));

						const { displayName } = store.getState().settings;
						const { picture } = store.getState().me;

						await this.sendRequest('changeDisplayName', { displayName });
						await this.sendRequest('changePicture', { picture });
						break;
					}

					case 'signInRequired':
					{
						store.dispatch(roomActions.setSignInRequired(true));

						break;
					}

					case 'overRoomLimit':
					{
						store.dispatch(roomActions.setOverRoomLimit(true));

						break;
					}

					case 'roomReady':
					{
						const { turnServers } = notification.data;

						this._turnServers = turnServers;

						store.dispatch(roomActions.toggleJoined());
						store.dispatch(roomActions.setInLobby(false))
						await this._joinRoom({ joinVideo });

						break;
					}

					case 'roomBack':
					{
						await this._joinRoom({ joinVideo });

						break;
					}

					case 'lockRoom':
					{
						store.dispatch(
							roomActions.setRoomLocked());

						store.dispatch(requestActions.notify(
							{
								text : 'Room is now locked'
							}));

						break;
					}

					case 'unlockRoom':
					{
						store.dispatch(
							roomActions.setRoomUnLocked());

						store.dispatch(requestActions.notify(
							{
								text :'Room is now unlocked'
							}));

						break;
					}

					case 'parkedPeer':
					{
						const { peerId } = notification.data;

						store.dispatch(
							lobbyPeerActions.addLobbyPeer(peerId));
						store.dispatch(
							roomActions.setToolbarsVisible(true));

						this._soundNotification();

						store.dispatch(requestActions.notify(
							{
								text :'New participant entered the lobby'
							}));

						break;
					}

					case 'parkedPeers':
					{
						const { lobbyPeers } = notification.data;

						if (lobbyPeers.length > 0)
						{
							lobbyPeers.forEach((peer) =>
							{
								store.dispatch(
									lobbyPeerActions.addLobbyPeer(peer.id));

								store.dispatch(
									lobbyPeerActions.setLobbyPeerDisplayName(
										peer.displayName,
										peer.id
									)
								);

								store.dispatch(
									lobbyPeerActions.setLobbyPeerPicture(
										peer.picture,
										peer.id
									)
								);
							});

							store.dispatch(
								roomActions.setToolbarsVisible(true));

							this._soundNotification();

							store.dispatch(requestActions.notify(
								{
									text : 'New participant entered the lobby'
								}));
						}

						break;
					}

					case 'lobby:peerClosed':
					{
						const { peerId } = notification.data;

						store.dispatch(
							lobbyPeerActions.removeLobbyPeer(peerId));

						store.dispatch(requestActions.notify(
							{
								text : 'Participant in lobby left'
							}));

						break;
					}

					case 'lobby:promotedPeer':
					{
						const { peerId } = notification.data;

						store.dispatch(
							lobbyPeerActions.removeLobbyPeer(peerId));

						break;
					}

					case 'lobby:changeDisplayName':
					{
						const { peerId, displayName } = notification.data;

						store.dispatch(
							lobbyPeerActions.setLobbyPeerDisplayName(displayName, peerId));
							
					let message = 'Participant in lobby changed name to ' + displayName		

						store.dispatch(requestActions.notify(
							{
								text :message
							}));

						break;
					}

					case 'setAccessCode':
					{
						const { accessCode } = notification.data;

						store.dispatch(
							roomActions.setAccessCode(accessCode));

						store.dispatch(requestActions.notify(
							{
								text : 'Access code for room updated'
							}));

						break;
					}

					case 'setJoinByAccessCode':
					{
						const { joinByAccessCode } = notification.data;

						store.dispatch(
							roomActions.setJoinByAccessCode(joinByAccessCode));

						if (joinByAccessCode)
						{
							store.dispatch(requestActions.notify(
								{
									text : 'Access code for room is now activated'
								}));
						}
						else
						{
							store.dispatch(requestActions.notify(
								{
									text : 'Access code for room is now deactivated'
								}));
						}

						break;
					}

					case 'activeSpeaker':
					{
						const { peerId } = notification.data;

						store.dispatch(
							roomActions.setRoomActiveSpeaker(peerId));

						if (peerId && peerId !== this._peerId)
							this._spotlights.handleActiveSpeaker(peerId);

						break;
					}

					case 'changeDisplayName':
					{
						const { peerId, displayName, oldDisplayName } = notification.data;

						store.dispatch(
							peerActions.setPeerDisplayName(displayName, peerId));


						let message = oldDisplayName +' is now ' + displayName

						store.dispatch(requestActions.notify(
							{
								text : message
							}));

						break;
					}

					case 'changePicture':
					{
						const { peerId, picture } = notification.data;

						store.dispatch(peerActions.setPeerPicture(peerId, picture));

						break;
					}

					case 'raisedHand':
					{
						const {
							peerId,
							raisedHand,
							raisedHandTimestamp
						} = notification.data;

						store.dispatch(
							peerActions.setPeerRaisedHand(
								peerId,
								raisedHand,
								raisedHandTimestamp
							)
						);

						const { displayName } = store.getState().peers[peerId];

						let text;
					

						if (displayName)
						{
							if (raisedHand)
							{
								text =  displayName +' raised hand'
							}
							else
							{
							
								text =  displayName +' put hand down'
							}

							store.dispatch(requestActions.notify(
								{
									text
								}));
						}

						this._soundNotification();

						break;
					}

					case 'chatMessage':
					{
						const { peerId, chatMessage } = notification.data;

						store.dispatch(
							chatActions.addResponseMessage({ ...chatMessage, peerId }));

						if (
							!store.getState().toolarea.toolAreaOpen ||
							(store.getState().toolarea.toolAreaOpen &&
							store.getState().toolarea.currentToolTab !== 'chat')
						) // Make sound
						{
							store.dispatch(
								roomActions.setToolbarsVisible(true));
							this._soundNotification();
						}

						break;
					}

					case 'moderator:clearChat':
					{
						store.dispatch(chatActions.clearChat());

						store.dispatch(requestActions.notify(
							{
								text : 'Moderator cleared the chat'
							}));

						break;
					}

					case 'sendFile':
					{
						const { peerId, magnetUri } = notification.data;

						store.dispatch(fileActions.addFile(peerId, magnetUri));

						store.dispatch(requestActions.notify(
							{
								text : 'New file available'
							}));

						if (
							!store.getState().toolarea.toolAreaOpen ||
							(store.getState().toolarea.toolAreaOpen &&
							store.getState().toolarea.currentToolTab !== 'files')
						) // Make sound
						{
							store.dispatch(
								roomActions.setToolbarsVisible(true));
							this._soundNotification();
						}

						break;
					}

					case 'moderator:clearFileSharing':
					{
						store.dispatch(fileActions.clearFiles());

						store.dispatch(requestActions.notify(
							{
								text : 'Moderator cleared the files'
							}));

						break;
					}

					case 'producerScore':
					{
						const { producerId, score } = notification.data;

						store.dispatch(
							producerActions.setProducerScore(producerId, score));

						break;
					}

					case 'newPeer':
					{
						const { id, displayName, picture, roles,OrgazierPeerId } = notification.data;

						store.dispatch(
							peerActions.addPeer({ id, displayName, picture, roles,OrgazierPeerId, consumers: [] }));

						this._soundNotification();

						let message = displayName+' joined the room'

						store.dispatch(requestActions.notify(
							{
								text : message
							}));

						break;
					}

					case 'peerClosed':
					{
						const { peerId } = notification.data;

						store.dispatch(
							peerActions.removePeer(peerId));

						break;
					}

					case 'consumerClosed':
					{
						const { consumerId } = notification.data;
						const consumer = this._consumers.get(consumerId);

						if (!consumer)
							break;

						consumer.close();

						if (consumer.hark != null)
							consumer.hark.stop();

						this._consumers.delete(consumerId);

						const { peerId } = consumer.appData;

						store.dispatch(
							consumerActions.removeConsumer(consumerId, peerId));

						break;
					}

					case 'consumerPaused':
					{
						const { consumerId } = notification.data;
						const consumer = this._consumers.get(consumerId);

						if (!consumer)
							break;

						store.dispatch(
							consumerActions.setConsumerPaused(consumerId, 'remote'));

						break;
					}

					case 'consumerResumed':
					{
						const { consumerId } = notification.data;
						const consumer = this._consumers.get(consumerId);

						if (!consumer)
							break;

						store.dispatch(
							consumerActions.setConsumerResumed(consumerId, 'remote'));

						break;
					}

					case 'consumerLayersChanged':
					{
						const { consumerId, spatialLayer, temporalLayer } = notification.data;
						const consumer = this._consumers.get(consumerId);

						if (!consumer)
							break;

						store.dispatch(consumerActions.setConsumerCurrentLayers(
							consumerId, spatialLayer, temporalLayer));

						break;
					}

					case 'consumerScore':
					{
						const { consumerId, score } = notification.data;

						store.dispatch(
							consumerActions.setConsumerScore(consumerId, score));

						break;
					}

					case 'moderator:mute':
					{
					
							this.muteMic();

							store.dispatch(meActions.setAudioLocked(true));

							store.dispatch(requestActions.notify(
								{
									text : 'your audio is locked'
								}));
					

						break;
					}
					case 'moderator:unmute':
					{
						
							this.unmuteMic();
							store.dispatch(meActions.setAudioLocked(false));

							store.dispatch(requestActions.notify(
								{
									text : 'your audio is un locked'
								}));
						

						break;
					}

					case 'moderator:stopVideo':
					{
						this.disableWebcam();

						store.dispatch(meActions.setVideoLocked(true));

						store.dispatch(requestActions.notify(
							{
								text : 'your video is locked'
							}));

						break;
					}
					case 'moderator:playVideo':
					{
						this.enableWebcam();
						store.dispatch(meActions.setVideoLocked(false));

						store.dispatch(requestActions.notify(
							{
								text : 'your video is un locked'
							}));

						break;
					}

					case 'moderator:stopScreenSharing':
					{
						this.disableScreenSharing();

						store.dispatch(requestActions.notify(
							{
								text : 'Moderator stopped your screen sharing'
							}));

						break;
					}

					case 'moderator:kick':
					{
						// Need some feedback
						this.close(true);

						break;
					}

					case 'moderator:lowerHand':
					{
						this.setRaisedHand(false);

						break;
					}

					case 'gotRole':
					{
						const { peerId, role } = notification.data;

						if (peerId === this._peerId)
						{
							store.dispatch(meActions.addRole(role));

						    let message =  'You got the role: '+ role
							store.dispatch(requestActions.notify(
								{
									text : message
								}));
						}
						else
							store.dispatch(peerActions.addPeerRole(peerId, role));

						break;
					}

					case 'lostRole':
					{
						const { peerId, role } = notification.data;

						if (peerId === this._peerId)
						{
							store.dispatch(meActions.removeRole(role));

							let message =  'You lost the role: '+ role

							store.dispatch(requestActions.notify(
								{
									text : message
								}));
						}
						else
							store.dispatch(peerActions.removePeerRole(peerId, role));

						break;
					}

					default:
					{
						logger.error(
							'unknown notification.method "%s"', notification.method);
					}
				}
			}
			catch (error)
			{
				logger.error('error on socket "notification" event [error:"%o"]', error);

				store.dispatch(requestActions.notify(
					{
						type : 'error',
						text :'Error on server request'
					}));
			}

		});
	}

	async _joinRoom({ joinVideo })
	{
		logger.debug('_joinRoom()');

		const { displayName } = store.getState().settings;
		const { picture } = store.getState().me;

		try
		{
			// this._torrentSupport = WebTorrent.WEBRTC_SUPPORT;

			// this._webTorrent = this._torrentSupport && new WebTorrent({
			// 	tracker : {
			// 		rtcConfig : {
			// 			iceServers : this._turnServers
			// 		}
			// 	}
			// });

			// this._webTorrent.on('error', (error) =>
			// {
			// 	logger.error('Filesharing [error:"%o"]', error);

			// 	store.dispatch(requestActions.notify(
			// 		{
			// 			type : 'error',
			// 			text : 'There was a filesharing error'
			// 		}));
			// });

			this._mediasoupDevice = new mediasoupClient.Device();

			const routerRtpCapabilities =
				await this.sendRequest('getRouterRtpCapabilities');

			routerRtpCapabilities.headerExtensions = routerRtpCapabilities.headerExtensions
				.filter((ext) => ext.uri !== 'urn:3gpp:video-orientation');

			await this._mediasoupDevice.load({ routerRtpCapabilities });

			if (this._produce)
			{
				const transportInfo = await this.sendRequest(
					'createWebRtcTransport',
					{
						forceTcp  : this._forceTcp,
						producing : true,
						consuming : false
					});

				const {
					id,
					iceParameters,
					iceCandidates,
					dtlsParameters
				} = transportInfo;

				this._sendTransport = this._mediasoupDevice.createSendTransport(
					{
						id,
						iceParameters,
						iceCandidates,
						dtlsParameters,
						iceServers             : this._turnServers,
						// TODO: Fix for issue #72
						iceTransportPolicy     : this._device.flag === 'firefox' && this._turnServers ? 'relay' : undefined,
						proprietaryConstraints : PC_PROPRIETARY_CONSTRAINTS
					});

				this._sendTransport.on(
					'connect', ({ dtlsParameters }, callback, errback) => // eslint-disable-line no-shadow
					{
						this.sendRequest(
							'connectWebRtcTransport',
							{
								transportId : this._sendTransport.id,
								dtlsParameters
							})
							.then(callback)
							.catch(errback);
					});

				this._sendTransport.on(
					'produce', async ({ kind, rtpParameters, appData }, callback, errback) =>
					{
						try
						{
							// eslint-disable-next-line no-shadow
							const { id } = await this.sendRequest(
								'produce',
								{
									transportId : this._sendTransport.id,
									kind,
									rtpParameters,
									appData
								});

							callback({ id });
						}
						catch (error)
						{
							errback(error);
						}
					});
			}

			const transportInfo = await this.sendRequest(
				'createWebRtcTransport',
				{
					forceTcp  : this._forceTcp,
					producing : false,
					consuming : true
				});

			const {
				id,
				iceParameters,
				iceCandidates,
				dtlsParameters
			} = transportInfo;

			this._recvTransport = this._mediasoupDevice.createRecvTransport(
				{
					id,
					iceParameters,
					iceCandidates,
					dtlsParameters,
					iceServers         : this._turnServers,
					// TODO: Fix for issue #72
					iceTransportPolicy : this._device.flag === 'firefox' && this._turnServers ? 'relay' : undefined
				});

			this._recvTransport.on(
				'connect', ({ dtlsParameters }, callback, errback) => // eslint-disable-line no-shadow
				{
					this.sendRequest(
						'connectWebRtcTransport',
						{
							transportId : this._recvTransport.id,
							dtlsParameters
						})
						.then(callback)
						.catch(errback);
				});

			// Set our media capabilities.
			store.dispatch(meActions.setMediaCapabilities(
				{
					canSendMic     : this._mediasoupDevice.canProduce('audio'),
					canSendWebcam  : this._mediasoupDevice.canProduce('video'),
					canShareScreen : this._mediasoupDevice.canProduce('video') &&
						this._screenSharing.isScreenShareAvailable(),
					canShareFiles : this._torrentSupport
				}));

			const {
				authenticated,
				roles,
				peers,
				tracker,
				roomPermissions,
				allowWhenRoleMissing,
				chatHistory,
				fileHistory,
				lastNHistory,
				locked,
				lobbyPeers,
				accessCode
			} = await this.sendRequest(
				'join',
				{
					displayName     : displayName,
					picture         : picture,
					rtpCapabilities : this._mediasoupDevice.rtpCapabilities
				});

			logger.debug(
				'_joinRoom() joined [authenticated:"%s", peers:"%o", roles:"%o"]',
				authenticated,
				peers,
				roles
			);

			tracker && (this._tracker = tracker);

			store.dispatch(meActions.loggedIn(authenticated));

			store.dispatch(roomActions.setRoomPermissions(roomPermissions));

			if (allowWhenRoleMissing)
				store.dispatch(roomActions.setAllowWhenRoleMissing(allowWhenRoleMissing));

			const myRoles = store.getState().me.roles;

			for (const role of roles)
			{
				if (!myRoles.includes(role))
				{
					store.dispatch(meActions.addRole(role));

					let message ='You got the role: ' + role

					store.dispatch(requestActions.notify(
						{
							text : message
						}));
				}
			}

			for (const peer of peers)
			{
				store.dispatch(
					peerActions.addPeer({ ...peer, consumers: [] }));
			}

			this._spotlights.addPeers(peers);

			this._spotlights.on('spotlights-updated', (spotlights) =>
			{
				store.dispatch(roomActions.setSpotlights(spotlights));
				this.updateSpotlights(spotlights);
			});

			(chatHistory.length > 0) && store.dispatch(
				chatActions.addChatHistory(chatHistory));

			(fileHistory.length > 0) && store.dispatch(
				fileActions.addFileHistory(fileHistory));

			if (lastNHistory.length > 0)
			{
				logger.debug('_joinRoom() | got lastN history');

				this._spotlights.addSpeakerList(
					lastNHistory.filter((peerId) => peerId !== this._peerId)
				);
			}

			locked ?
				store.dispatch(roomActions.setRoomLocked()) :
				store.dispatch(roomActions.setRoomUnLocked());

			(lobbyPeers.length > 0) && lobbyPeers.forEach((peer) =>
			{
				store.dispatch(
					lobbyPeerActions.addLobbyPeer(peer.id));
				store.dispatch(
					lobbyPeerActions.setLobbyPeerDisplayName(peer.displayName, peer.id));
				store.dispatch(
					lobbyPeerActions.setLobbyPeerPicture(peer.picture, peer.id));
			});

			(accessCode != null) && store.dispatch(
				roomActions.setAccessCode(accessCode));

			// Don't produce if explicitly requested to not to do it.
			if (this._produce)
			{
				if (this._mediasoupDevice.canProduce('audio'))
					if (!this._muted)
					{
						await this.updateMic({ start: true });
						this.muteMic();
						// let autoMuteThreshold = 1;

						// if ('autoMuteThreshold' in window.config)
						// {
						// 	autoMuteThreshold = window.config.autoMuteThreshold;
						// }
						// if (autoMuteThreshold && peers.length >= autoMuteThreshold)
							
					}

				if (joinVideo)
					this.updateWebcam({ start: true });
			}

			await this._updateAudioOutputDevices();

			const { selectedAudioOutputDevice } = store.getState().settings;

			if (!selectedAudioOutputDevice && this._audioOutputDevices !== {})
			{
				store.dispatch(
					settingsActions.setSelectedAudioOutputDevice(
						Object.keys(this._audioOutputDevices)[0]
					)
				);
			}

			store.dispatch(roomActions.setRoomState('connected'));

			// Clean all the existing notifications.
			store.dispatch(notificationActions.removeAllNotifications());

			store.dispatch(requestActions.notify(
				{
					text :`You have joined the room - ${this._roomId}`
				}));

			this._spotlights.start();
		}
		catch (error)
		{
			logger.error('_joinRoom() [error:"%o"]', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : 'Unable to join the room'
				}));

			this.close();
		}
	}

	async lockRoom()
	{
		logger.debug('lockRoom()');

		try
		{
			await this.sendRequest('lockRoom');

			store.dispatch(
				roomActions.setRoomLocked());

			store.dispatch(requestActions.notify(
				{
					text : 'You locked the room'
				}));
		}
		catch (error)
		{
			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : 'Unable to lock the room'
				}));

			logger.error('lockRoom() [error:"%o"]', error);
		}
	}

	async unlockRoom()
	{
		logger.debug('unlockRoom()');

		try
		{
			await this.sendRequest('unlockRoom');

			store.dispatch(
				roomActions.setRoomUnLocked());

			store.dispatch(requestActions.notify(
				{
					text :  'You unlocked the room'
				}));
		}
		catch (error)
		{
			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : 'Unable to unlock the room'
				}));

			logger.error('unlockRoom() [error:"%o"]', error);
		}
	}

	async setAccessCode(code)
	{
		logger.debug('setAccessCode()');

		try
		{
			await this.sendRequest('setAccessCode', { accessCode: code });

			store.dispatch(
				roomActions.setAccessCode(code));

			store.dispatch(requestActions.notify(
				{
					text : 'Access code saved.'
				}));
		}
		catch (error)
		{
			logger.error('setAccessCode() [error:"%o"]', error);
			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : 'Unable to set access code.'
				}));
		}
	}

	async setJoinByAccessCode(value)
	{
		logger.debug('setJoinByAccessCode()');

		try
		{
			await this.sendRequest('setJoinByAccessCode', { joinByAccessCode: value });

			store.dispatch(
				roomActions.setJoinByAccessCode(value));

			store.dispatch(requestActions.notify(
				{
					text : `You switched Join by access-code to ${value}`
				}));
		}
		catch (error)
		{
			logger.error('setAccessCode() [error:"%o"]', error);
			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : 'Unable to set join by access code.'
				}));
		}
	}

	async addExtraVideo(videoDeviceId)
	{
		logger.debug(
			'addExtraVideo() [videoDeviceId:"%s"]',
			videoDeviceId
		);

		store.dispatch(
			roomActions.setExtraVideoOpen(false));

		if (!this._mediasoupDevice.canProduce('video'))
		{
			logger.error('addExtraVideo() | cannot produce video');

			return;
		}

		let track;

		store.dispatch(
			meActions.setWebcamInProgress(true));

		try
		{
			const device = this._webcams[videoDeviceId];
			const resolution = store.getState().settings.resolution;

			if (!device)
				throw new Error('no webcam devices');

			const stream = await navigator.mediaDevices.getUserMedia(
				{
					video :
					{
						deviceId : { ideal: videoDeviceId },
						...VIDEO_CONSTRAINS[resolution]
					}
				});

			([ track ] = stream.getVideoTracks());

			let producer;

			if (this._useSimulcast)
			{
				// If VP9 is the only available video codec then use SVC.
				const firstVideoCodec = this._mediasoupDevice
					.rtpCapabilities
					.codecs
					.find((c) => c.kind === 'video');

				let encodings;

				if (firstVideoCodec.mimeType.toLowerCase() === 'video/vp9')
					encodings = VIDEO_KSVC_ENCODINGS;
				else if ('simulcastEncodings' in window.config)
					encodings = window.config.simulcastEncodings;
				else
					encodings = VIDEO_SIMULCAST_ENCODINGS;

				producer = await this._sendTransport.produce(
					{
						track,
						encodings,
						codecOptions :
						{
							videoGoogleStartBitrate : 1000
						},
						appData :
						{
							source : 'extravideo'
						}
					});
			}
			else
			{
				producer = await this._sendTransport.produce({
					track,
					appData :
					{
						source : 'extravideo'
					}
				});
			}

			this._extraVideoProducers.set(producer.id, producer);

			store.dispatch(producerActions.addProducer(
				{
					id            : producer.id,
					deviceLabel   : device.label,
					source        : 'extravideo',
					paused        : producer.paused,
					track         : producer.track,
					rtpParameters : producer.rtpParameters,
					codec         : producer.rtpParameters.codecs[0].mimeType.split('/')[1]
				}));

			// store.dispatch(settingsActions.setSelectedWebcamDevice(deviceId));

			await this._updateWebcams();

			producer.on('transportclose', () =>
			{
				this._extraVideoProducers.delete(producer.id);

				producer = null;
			});

			producer.on('trackended', () =>
			{
				store.dispatch(requestActions.notify(
					{
						type : 'error',
						text : 'Camera disconnected'
					}));

				this.disableExtraVideo(producer.id)
					.catch(() => {});
			});

			logger.debug('addExtraVideo() succeeded');
		}
		catch (error)
		{
			logger.error('addExtraVideo() [error:"%o"]', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text :'An error occurred while accessing your camera'
				}));

			if (track)
				track.stop();
		}

		store.dispatch(
			meActions.setWebcamInProgress(false));
	}

	async disableMic()
	{
		logger.debug('disableMic()');

		if (!this._micProducer)
			return;

		store.dispatch(meActions.setAudioInProgress(true));

		this._micProducer.close();

		store.dispatch(
			producerActions.removeProducer(this._micProducer.id));

		try
		{
			await this.sendRequest(
				'closeProducer', { producerId: this._micProducer.id });
		}
		catch (error)
		{
			logger.error('disableMic() [error:"%o"]', error);
		}

		this._micProducer = null;

		store.dispatch(meActions.setAudioInProgress(false));
	}

	async updateScreenSharing({
		start = false,
		newResolution = null,
		newFrameRate = null
	} = {})
	{
		logger.debug('updateScreenSharing() [start:"%s"]', start);

		let track;

		try
		{
			const available = this._screenSharing.isScreenShareAvailable();

			if (!available)
				throw new Error('screen sharing not available');

			if (!this._mediasoupDevice.canProduce('video'))
				throw new Error('cannot produce video');

			if (newResolution)
				store.dispatch(settingsActions.setScreenSharingResolution(newResolution));

			if (newFrameRate)
				store.dispatch(settingsActions.setScreenSharingFrameRate(newFrameRate));

			store.dispatch(meActions.setScreenShareInProgress(true));

			const {
				screenSharingResolution,
				screenSharingFrameRate
			} = store.getState().settings;

			if (start)
			{
				const stream = await this._screenSharing.start({
					...VIDEO_CONSTRAINS[screenSharingResolution],
					frameRate : screenSharingFrameRate
				});

				([ track ] = stream.getVideoTracks());

				if (this._useSharingSimulcast)
				{
					// If VP9 is the only available video codec then use SVC.
					const firstVideoCodec = this._mediasoupDevice
						.rtpCapabilities
						.codecs
						.find((c) => c.kind === 'video');

					let encodings;

					if (firstVideoCodec.mimeType.toLowerCase() === 'video/vp9')
					{
						encodings = VIDEO_SVC_ENCODINGS;
					}
					else if ('simulcastEncodings' in window.config)
					{
						encodings = window.config.simulcastEncodings
							.map((encoding) => ({ ...encoding, dtx: true }));
					}
					else
					{
						encodings = VIDEO_SIMULCAST_ENCODINGS
							.map((encoding) => ({ ...encoding, dtx: true }));
					}

					this._screenSharingProducer = await this._sendTransport.produce(
						{
							track,
							encodings,
							codecOptions :
							{
								videoGoogleStartBitrate : 1000
							},
							appData :
							{
								source : 'screen'
							}
						});
				}
				else
				{
					this._screenSharingProducer = await this._sendTransport.produce({
						track,
						appData :
						{
							source : 'screen'
						}
					});
				}

				store.dispatch(producerActions.addProducer(
					{
						id            : this._screenSharingProducer.id,
						deviceLabel   : 'screen',
						source        : 'screen',
						paused        : this._screenSharingProducer.paused,
						track         : this._screenSharingProducer.track,
						rtpParameters : this._screenSharingProducer.rtpParameters,
						codec         : this._screenSharingProducer.rtpParameters.codecs[0].mimeType.split('/')[1]
					}));

				this._screenSharingProducer.on('transportclose', () =>
				{
					this._screenSharingProducer = null;
				});

				this._screenSharingProducer.on('trackended', () =>
				{
					store.dispatch(requestActions.notify(
						{
							type : 'error',
							text : 'Screen sharing disconnected'
						}));

					this.disableScreenSharing();
				});
			}
			else if (this._screenSharingProducer)
			{
				({ track } = this._screenSharingProducer);

				await track.applyConstraints(
					{
						...VIDEO_CONSTRAINS[screenSharingResolution],
						frameRate : screenSharingFrameRate
					}
				);
			}
		}
		catch (error)
		{
			logger.error('updateScreenSharing() [error:"%o"]', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : 'An error occurred while accessing your screen'
				}));

			if (track)
				track.stop();
		}

		store.dispatch(meActions.setScreenShareInProgress(false));
	}

	async disableScreenSharing()
	{
		logger.debug('disableScreenSharing()');

		if (!this._screenSharingProducer)
			return;

		store.dispatch(meActions.setScreenShareInProgress(true));

		this._screenSharingProducer.close();

		store.dispatch(
			producerActions.removeProducer(this._screenSharingProducer.id));

		try
		{
			await this.sendRequest(
				'closeProducer', { producerId: this._screenSharingProducer.id });
		}
		catch (error)
		{
			logger.error('disableScreenSharing() [error:"%o"]', error);
		}

		this._screenSharingProducer = null;

		this._screenSharing.stop();

		store.dispatch(meActions.setScreenShareInProgress(false));
	}

	async disableExtraVideo(id)
	{
		logger.debug('disableExtraVideo()');

		const producer = this._extraVideoProducers.get(id);

		if (!producer)
			return;

		store.dispatch(meActions.setWebcamInProgress(true));

		producer.close();

		store.dispatch(
			producerActions.removeProducer(id));

		try
		{
			await this.sendRequest(
				'closeProducer', { producerId: id });
		}
		catch (error)
		{
			logger.error('disableWebcam() [error:"%o"]', error);
		}

		this._extraVideoProducers.delete(id);

		store.dispatch(meActions.setWebcamInProgress(false));
	}

	async disableWebcam()
	{
		logger.debug('disableWebcam()');

		if (!this._webcamProducer)
			return;

		store.dispatch(meActions.setWebcamInProgress(true));

		this._webcamProducer.close();

		store.dispatch(
			producerActions.removeProducer(this._webcamProducer.id));

		try
		{
			await this.sendRequest(
				'closeProducer', { producerId: this._webcamProducer.id });
		}
		catch (error)
		{
			logger.error('disableWebcam() [error:"%o"]', error);
		}

		this._webcamProducer = null;

		store.dispatch(meActions.setWebcamInProgress(false));
	}

	async _setNoiseThreshold(threshold)
	{
		logger.debug('_setNoiseThreshold() [threshold:"%s"]', threshold);

		this._hark.setThreshold(threshold);

		store.dispatch(
			settingsActions.setNoiseThreshold(threshold));
	}

	async _updateAudioDevices()
	{
		logger.debug('_updateAudioDevices()');

		// Reset the list.
		this._audioDevices = {};

		try
		{
			logger.debug('_updateAudioDevices() | calling enumerateDevices()');

			const devices = await navigator.mediaDevices.enumerateDevices();

			for (const device of devices)
			{
			
				if (device.kind !== 'audioinput')
					continue;

				this._audioDevices[device.deviceId] = device;
			}

			store.dispatch(
				meActions.setAudioDevices(this._audioDevices));
		}
		catch (error)
		{
			logger.error('_updateAudioDevices() [error:"%o"]', error);
		}
	}

	async _updateWebcams()
	{
		logger.debug('_updateWebcams()');

		// Reset the list.
		this._webcams = {};

		try
		{
			logger.debug('_updateWebcams() | calling enumerateDevices()');

			const devices = await navigator.mediaDevices.enumerateDevices();

			for (const device of devices)
			{
				if (device.kind !== 'videoinput')
					continue;

				this._webcams[device.deviceId] = device;
			}

			store.dispatch(
				meActions.setWebcamDevices(this._webcams));
		}
		catch (error)
		{
			logger.error('_updateWebcams() [error:"%o"]', error);
		}
	}

	async _getAudioDeviceId()
	{
		logger.debug('_getAudioDeviceId()');

		try
		{
			logger.debug('_getAudioDeviceId() | calling _updateAudioDeviceId()');

			await this._updateAudioDevices();

			const { selectedAudioDevice } = store.getState().settings;

			if (selectedAudioDevice && this._audioDevices[selectedAudioDevice])
				return selectedAudioDevice;
			else
			{
				const audioDevices = Object.values(this._audioDevices);

				return audioDevices[0] ? audioDevices[0].deviceId : null;
			}
		}
		catch (error)
		{
			logger.error('_getAudioDeviceId() [error:"%o"]', error);
		}
	}

	async _getWebcamDeviceId()
	{
		logger.debug('_getWebcamDeviceId()');

		try
		{
			logger.debug('_getWebcamDeviceId() | calling _updateWebcams()');

			await this._updateWebcams();

			const { selectedWebcam } = store.getState().settings;

			if (selectedWebcam && this._webcams[selectedWebcam])
				return selectedWebcam;
			else
			{
				const webcams = Object.values(this._webcams);

				return webcams[0] ? webcams[0].deviceId : null;
			}
		}
		catch (error)
		{
			logger.error('_getWebcamDeviceId() [error:"%o"]', error);
		}
	}

	async _updateAudioOutputDevices()
	{
		logger.debug('_updateAudioOutputDevices()');

		// Reset the list.
		this._audioOutputDevices = {};

		try
		{
			logger.debug('_updateAudioOutputDevices() | calling enumerateDevices()');

			const devices = await navigator.mediaDevices.enumerateDevices();

			for (const device of devices)
			{
			
				if (device.kind !== 'audiooutput')
					continue;

				this._audioOutputDevices[device.deviceId] = device;
			}

			store.dispatch(
				meActions.setAudioOutputDevices(this._audioOutputDevices));
		}
		catch (error)
		{
			logger.error('_updateAudioOutputDevices() [error:"%o"]', error);
		}
	}

}