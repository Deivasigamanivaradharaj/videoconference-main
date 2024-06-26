#!/usr/bin/env node

process.title = 'dlc-server';

const config = require('./config/config');
const fs = require('fs');
const http = require('http');
const spdy = require('spdy');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const mediasoup = require('mediasoup');
const AwaitQueue = require('awaitqueue');
const Logger = require('./lib/Logger');
const Room = require('./lib/Room');
const Peer = require('./lib/Peer');
const base64 = require('base-64');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');

var cors = require('cors')

const userRoles = require('./userRoles');

// auth
// const passport = require('passport');
// const LTIStrategy = require('passport-lti');
// const imsLti = require('ims-lti');
const redis = require('redis');
const redisClient = redis.createClient(config.redisOptions);
// const { Issuer, Strategy } = require('openid-client');
const expressSession = require('express-session');
const RedisStore = require('connect-redis')(expressSession);
const sharedSession = require('express-socket.io-session');
const promExporter = require('./lib/promExporter');
const sioredis = require('socket.io-redis');
const { v4: uuidv4 } = require('uuid');




/* eslint-disable no-console */
console.log('- process.env.DEBUG:', process.env.DEBUG || '*');
console.log('- config.mediasoup.worker.logLevel:', config.mediasoup.worker.logLevel);
console.log('- config.mediasoup.worker.logTags:', config.mediasoup.worker.logTags);
/* eslint-enable no-console */

const childLogger =  Logger.child({ requestId: '451' }); //new Logger();

const queue = new AwaitQueue.AwaitQueue();

let statusLogger = null;

if ('StatusLogger' in config)
	statusLogger = new config.StatusLogger();

// mediasoup Workers.
// @type {Array<mediasoup.Worker>}
const mediasoupWorkers = [];

// Map of Room instances indexed by roomId.
const rooms = new Map();

// Map of Peer instances indexed by peerId.
const peers = new Map();
const peerRoles = new Map();
const roomOrganizers = new Map();
// TLS server configuration.
const tls =
{
	cert          : fs.readFileSync(config.tls.cert),
	key           : fs.readFileSync(config.tls.key),
	secureOptions : 'tlsv12',
	ciphers       :
	[
		'ECDHE-ECDSA-AES128-GCM-SHA256',
		'ECDHE-RSA-AES128-GCM-SHA256',
		'ECDHE-ECDSA-AES256-GCM-SHA384',
		'ECDHE-RSA-AES256-GCM-SHA384',
		'ECDHE-ECDSA-CHACHA20-POLY1305',
		'ECDHE-RSA-CHACHA20-POLY1305',
		'DHE-RSA-AES128-GCM-SHA256',
		'DHE-RSA-AES256-GCM-SHA384'
	].join(':'),
	honorCipherOrder : true
};

const app = express();

app.use(helmet.hsts());

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const session = expressSession({
	secret            : config.cookieSecret,
	name              : config.cookieName,
	resave            : true,
	saveUninitialized : true,
	store             : new RedisStore({ client: redisClient }),
	cookie            : {
		secure   : true,
		httpOnly : true,
		maxAge   : 60 * 60 * 1000 // Expire after 1 hour since last request from user
	}
});

if (config.trustProxy)
{
	app.set('trust proxy', config.trustProxy);
}

app.use(session);

// passport.serializeUser((user, done) =>
// {
// 	done(null, user);
// });

// passport.deserializeUser((user, done) =>
// {
// 	done(null, user);
// });

let mainListener;
let io;
let oidcClient;
let oidcStrategy;

async function run()
{
	try
	{
			// start Prometheus exporter
		if (config.prometheus)
		{
			await promExporter(rooms, peers, config.prometheus);
		}

		if (typeof(config.auth) === 'undefined')
		{
			childLogger.warn('Auth is not configured properly!');
		}
		else
		{
			await setupAuth();
		}

		// Run a mediasoup Worker.
		await runMediasoupWorkers();

		// Run HTTPS server.
		await runHttpsServer();

		// Run WebSocketServer.
		await runWebSocketServer();

		// const errorHandler = (err, req, res) =>
		// {
		// 	const trackingId = uuidv4();

		// 	res.status(500).send(
		// 		`<h1>Internal Server Error</h1>
		// 		<p>If you report this error, please also report this 
		// 		<i>tracking ID</i> which makes it possible to locate your session
		// 		in the logs which are available to the system administrator: 
		// 		<b>${trackingId}</b></p>`
		// 	);
		// 	logger.error(
		// 		'Express error handler dump with tracking ID: %s, error dump: %o',
		// 		trackingId, err);
		// };

		// // eslint-disable-next-line no-unused-vars
		// app.use(errorHandler);
	}
	catch (error)
	{
		childLogger.error('run() [error:"%o"]', error);
	}
}

function statusLog()
{
	if (statusLogger)
	{
		statusLogger.log({
			rooms : rooms,
			peers : peers
		});
	}
}

const whitelist = ['http://localhost:3000','https://192.168.1.4:3000','https://192.168.1.4:3001'];
const corsOptions = {
  credentials: true, // This is important.
  origin: (origin, callback) => {
    if(!origin || whitelist.includes(origin))
      return callback(null, true)

      callback(new Error('Not allowed by CORS'));
  }
}


async function runHttpsServer()
{
	app.use(cors(corsOptions))
	app.use(compression());
	
	app.use('/.well-known/acme-challenge', express.static('public/.well-known/acme-challenge'));
	// Serve all files in the public folder as static files.
	
	app.use('/config',express.static(`${__dirname}/public/config`));
	app.use('/static',express.static(`${__dirname}/public/static`));
	app.use('/resources',express.static(`${__dirname}/public/resources`));

	app.get('/',(req,res)=>{
		res.sendFile(`${__dirname}/public/index.html`)
	})

	app.all('/getDetails', function (req, res, next) {
		let jwttooke= req.headers.authorization.split("Bearer ")
		res.json(getDetails(jwttooke[1],req.query.peerId))
	
		next() // pass control to the next handler
	})

//	app.use((req, res) => res.sendFile(`${__dirname}/public/index.html`));

	if (config.httpOnly === true)
	{
		// http
		mainListener = http.createServer(app);
	}
	else
	{
		// https
		mainListener = spdy.createServer(tls, app);

		// http
		const redirectListener = http.createServer(app);

		if (config.listeningHost)
			redirectListener.listen(config.listeningRedirectPort, config.listeningHost);
		else
			redirectListener.listen(config.listeningRedirectPort);
	}

	// https or http
	if (config.listeningHost)
		mainListener.listen(config.listeningPort, config.listeningHost);
	else
		mainListener.listen(config.listeningPort);
}

function isPathAlreadyTaken(url)
{
	const alreadyTakenPath =
	[
		'/config/',
		'/static/',
		'/images/',
		'/sounds/',
		'/favicon.',
		'/auth/'
	];

	alreadyTakenPath.forEach((path) =>
	{
		if (url.toString().startsWith(path))
			return true;
	});

	return false;
}

/**
 * Create a WebSocketServer to allow WebSocket connections from browsers.
 */
async function runWebSocketServer()
{
	io = require('socket.io')(mainListener);

	io.adapter(sioredis(config.redisOptions));

	io.use(
		sharedSession(session, {
			autoSave : true
		})
	);

	// Handle connections from clients.
	io.on('connection', (socket) =>
	{
		const { roomId, peerId } = socket.handshake.query;

		if (!roomId || !peerId)
		{
			childLogger.warn('connection request without roomId and/or peerId');

			socket.disconnect(true);

			return;
		}

		childLogger.info(
			'connection request [roomId:"%s", peerId:"%s"]', roomId, peerId);

		queue.push(async () =>
		{
			const { token } = socket.handshake.session;

			const room = await getorCreateRoom({mediasoupWorkers, roomId });
			if (!room)
			{
				childLogger.warn('connection request without roomId and/or peerId');
	 
				socket.disconnect(true);
			}

			let peer = peers.get(peerId);
			let peerRole = peerRoles.get(peerId)
			let OrgazierPeerId = roomOrganizers.get(roomId)
			
			let returning = false;
			
			if (peer && !token)
			{ // Don't allow hijacking sessions
				socket.disconnect(true);

				return;
			}
			else if (token && room.verifyPeer({ id: peerId, token }))
			{ // Returning user, remove if old peer exists
				if (peer)
					peer.close();

				returning = true;
			}

			peer = new Peer({ id: peerId, roomId, socket,role:peerRole,OrgazierPeerId });

			peers.set(peerId, peer);

			peer.on('close', () =>
			{
				peers.delete(peerId);
				peerRoles.delete(peerId);

				statusLog();
			});

			// if (
			// 	Boolean(socket.handshake.session.passport) &&
			// 	Boolean(socket.handshake.session.passport.user)
			// )
			// {
			// 	const {
			// 		id,
			// 		displayName,
			// 		picture,
			// 		email,
			// 		_userinfo
			// 	} = socket.handshake.session.passport.user;

			// 	peer.authId = id;
			// 	peer.displayName = displayName;
			// 	peer.picture = picture;
			// 	peer.email = email;
			// 	peer.authenticated = true;

			// 	if (typeof config.userMapping === 'function')
			// 	{
			// 		await config.userMapping({ peer, roomId, userinfo: _userinfo });
			// 	}
			// }

			room.handlePeer({ peer, returning });

			statusLog();
		})
		.catch((error) =>
		{
			childLogger.error('room creation or room joining failed [error:"%o"]', error);

			if (socket)
				socket.disconnect(true);

			return;
		});
	});
}

/**
 * Launch as many mediasoup Workers as given in the configuration file.
 */
async function runMediasoupWorkers()
{
	const { numWorkers } = config.mediasoup;

	childLogger.info('running %d mediasoup Workers...', numWorkers);

	for (let i = 0; i < numWorkers; ++i)
	{
		const worker = await mediasoup.createWorker(
			{
				logLevel   : config.mediasoup.worker.logLevel,
				logTags    : config.mediasoup.worker.logTags,
				rtcMinPort : config.mediasoup.worker.rtcMinPort,
				rtcMaxPort : config.mediasoup.worker.rtcMaxPort
			});

		worker.on('died', () =>
		{
			childLogger.error(
				'mediasoup Worker died, exiting  in 2 seconds... [pid:%d]', worker.pid);

			setTimeout(() => process.exit(1), 2000);
		});

		mediasoupWorkers.push(worker);
	}
}

/**
 * Get a Room instance (or create one if it does not exist).
 */
async function getorCreateRoom({roomId })
{
	let room = rooms.get(roomId);

	// If the Room does not exist create a new one.
	if (!room)
	{
		childLogger.info('creating a new Room [roomId:"%s"]', roomId);

		//const mediasoupWorker = getMediasoupWorker();

		room = await Room.create({ mediasoupWorkers, roomId });

		rooms.set(roomId, room);

		statusLog();

		room.on('close', () =>
		{
			rooms.delete(roomId);
			roomOrganizers.delete(roomId);

			statusLog();
		});
	}

	return room;
}
 

function getDetails(token,peerId){

			let decoded ={roomId:"",name:""}
		try
		{								
		
			decoded	= jwt.verify(token,"qwertyuiopasdfghjklzxcvbnm123456");
			peerRoles.set(peerId, decoded.role)
			if(decoded.role == "organizer"){
				roomOrganizers.set(decoded.roomId, peerId)
			}
			
		}
		catch (err)
		{
			childLogger.warn('verifyPeer() | invalid token');
			return decoded;
		}

		return decoded;
	
}

run();
