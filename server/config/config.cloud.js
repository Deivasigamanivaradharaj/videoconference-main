const os = require('os');
const userRoles = require('../userRoles');

const {
	BYPASS_ROOM_LOCK,
	BYPASS_LOBBY
} = require('../access');

const {
	CHANGE_ROOM_LOCK,
	PROMOTE_PEER,
	SEND_CHAT,
	MODERATE_CHAT,
	SHARE_SCREEN,
	EXTRA_VIDEO,
	SHARE_FILE,
	MODERATE_FILES,
	MODERATE_ROOM,
	VIEW_ALL_PEERS,
	JOIN_ROOM,
} = require('../permissions');

module.exports =
{

   TurnServers : [
		{
			urls : [
				'turn:172.107.178.24:3478?transport=tcp'
			],
			username   : 'coturn',
			credential : 'coturn'
		}
	],
	fileTracker  : '',
	redisOptions : {url :'redis://redis:red_ccAdmin@100@172.107.178.24:30003'},
	// session cookie secret
	cookieSecret : 'dlcAdmin@!oo',
	cookieName   : 'dlc.sid',
	// if you use encrypted private key the set the passphrase
	tls          :
	{
		cert : `${__dirname}/../certs/cert.pem`,
		// passphrase: 'key_password'
		key  : `${__dirname}/../certs/key.pem`
	},
	
	listeningPort         : 3000,
	trustProxy            : '',
	listeningRedirectPort :9090,

	maxUsersPerRoom:100,

	httpOnly:false,

	listeningHost:"172.107.178.24",

	accessFromRoles : {
	
		[BYPASS_ROOM_LOCK] : [ userRoles.ADMIN ],
		[BYPASS_LOBBY]     : [ userRoles.NORMAL ],
		[JOIN_ROOM]: [ userRoles.MODERATOR,userRoles.ADMIN,userRoles.ORGANIZER,userRoles.NORMAL]
	},
	permissionsFromRoles : {
		// The role(s) have permission to lock/unlock a room
		[CHANGE_ROOM_LOCK] : [ userRoles.MODERATOR ],
		// The role(s) have permission to promote a peer from the lobby
		[PROMOTE_PEER]     : [ userRoles.NORMAL ],
		// The role(s) have permission to send chat messages
		[SEND_CHAT]        : [ userRoles.NORMAL ],
		// The role(s) have permission to moderate chat
		[MODERATE_CHAT]    : [ userRoles.MODERATOR ],
		// The role(s) have permission to share screen
		[SHARE_SCREEN]     : [ userRoles.NORMAL ],
		// The role(s) have permission to produce extra video
		[EXTRA_VIDEO]      : [ userRoles.NORMAL ],
		// The role(s) have permission to share files
		[SHARE_FILE]       : [ userRoles.NORMAL ],
		// The role(s) have permission to moderate files
		[MODERATE_FILES]   : [ userRoles.MODERATOR ],
		// The role(s) have permission to moderate room (e.g. kick user)
		[MODERATE_ROOM]    : [ userRoles.MODERATOR ,userRoles.ADMIN,userRoles.ORGANIZER],
		[VIEW_ALL_PEERS]    : [ userRoles.MODERATOR,userRoles.ADMIN,userRoles.ORGANIZER,userRoles.NORMAL],
	
	},
	
	allowWhenRoleMissing : [ CHANGE_ROOM_LOCK ],

	activateOnHostJoin   : true,

	routerScaleSize      : 40,
	// Socket timout value
	requestTimeout       : 20000,
	// Socket retries when timeout
	requestRetries       : 3,
	mediasoup            :
	{
		numWorkers : Object.keys(os.cpus()).length,
		// mediasoup Worker settings.
		worker     :
		{
			logLevel : 'debug',
			logTags  :
			[
				'info',
				'ice',
				'dtls',
				'rtp',
				'srtp',
				'rtcp'
			],
			rtcMinPort : 40000,
			rtcMaxPort : 49999
		},
		// mediasoup Router settings.
		router :
		{
			// Router media codecs.
			mediaCodecs :
			[
				{
					kind      : 'audio',
					mimeType  : 'audio/opus',
					clockRate : 48000,
					channels  : 2
				},
				{
					kind       : 'video',
					mimeType   : 'video/VP8',
					clockRate  : 90000,
					parameters :
					{
						'x-google-start-bitrate' : 1000
					}
				},
				{
					kind       : 'video',
					mimeType   : 'video/VP9',
					clockRate  : 90000,
					parameters :
					{
						'profile-id'             : 2,
						'x-google-start-bitrate' : 1000
					}
				},
				{
					kind       : 'video',
					mimeType   : 'video/h264',
					clockRate  : 90000,
					parameters :
					{
						'packetization-mode'      : 1,
						'profile-level-id'        : '4d0032',
						'level-asymmetry-allowed' : 1,
						'x-google-start-bitrate'  : 1000
					}
				},
				{
					kind       : 'video',
					mimeType   : 'video/h264',
					clockRate  : 90000,
					parameters :
					{
						'packetization-mode'      : 1,
						'profile-level-id'        : '42e01f',
						'level-asymmetry-allowed' : 1,
						'x-google-start-bitrate'  : 1000
					}
				}
			]
		},
		// mediasoup WebRtcTransport settings.
		webRtcTransport :
		{
			listenIps :
			[
				// change 192.0.2.1 IPv4 to your server's IPv4 address!!
				{ ip: '172.107.178.24', announcedIp: null }

				// Can have multiple listening interfaces
				// change 2001:DB8::1 IPv6 to your server's IPv6 address!!
				// { ip: '2001:DB8::1', announcedIp: null }
			],
			initialAvailableOutgoingBitrate : 1000000,
			minimumAvailableOutgoingBitrate : 600000,
			// Additional options that are not part of WebRtcTransportOptions.
			maxIncomingBitrate              : 1500000
		}
	},
	
	// Prometheus exporter
	
	prometheus: {
		deidentify: false, // deidentify IP addresses
		numeric: false, // show numeric IP addresses
		port: 8889, // allocated port
		quiet: false // include fewer labels
	}
	
};
