
import domready from 'domready';
import UrlParse from 'url-parse';
import React from 'react';
import { render } from 'react-dom';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css'

import * as serviceWorker from './serviceWorker';
import { Provider } from 'react-redux';
import {
	applyMiddleware as applyReduxMiddleware,
	createStore as createReduxStore
} from 'redux';
import thunk from 'redux-thunk';
import randomString from 'random-string';
import * as faceapi from 'face-api.js';
import Logger from './Logger';
import * as utils from './utils';
import randomName from './randomName';
import deviceInfo from './deviceInfo';
import RoomClient from './RoomClient';
import RoomContext from './RoomContext';
import * as cookiesManager from './cookiesManager';
import * as stateActions from './redux/stateActions';
import reducers from './redux/reducers';
import OraganizerView from './components/OraganizerView';
import StudentView from './components/StudentView';
import axios from 'axios'
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'

library.add(fas)


const logger = new Logger();
const reduxMiddlewares = [thunk];

let roomClient;


const store = createReduxStore(
	reducers,
	undefined,
	applyReduxMiddleware(...reduxMiddlewares)
);

window.STORE = store;




RoomClient.init({ store });
let urlParser =null;
const peerId = randomString({ length: 8 }).toLowerCase();
let roomId = ""
let displayName =""	
let eleMain=<StudentView/>
domready(async () => {
	logger.debug('DOM ready');

	await utils.initialize();
	urlParser = new UrlParse(window.location.href, true);
	window.URL_PARSER =urlParser;
	const token = urlParser.query.token
	 

	if(token){
		const AuthStr = 'Bearer '.concat(token); 
		axios.get(`/getdetails/?peerId=${peerId}`, { headers: { Authorization: AuthStr } })
		.then(response => {
			// If request is good...
			roomId =response.data.roomId;
			window.ROOM_ID = roomId;
			if(response.data.role === "organizer"){
				eleMain = 	<OraganizerView/>
			}
			
			displayName = response.data.name	
			run();
		})
		.catch((error) => {
			console.log('error ' + error);
		});
	}
	else{
		roomId =urlParser.query.join;
		window.ROOM_ID = roomId;
		displayName = urlParser.query.displayName || (cookiesManager.getUser() || {}).displayName;
		run();
	}


});


async function run() {
	logger.debug('run() [environment:%s]', process.env.NODE_ENV);


	const handler = urlParser.query.handler;
	const useSimulcast = urlParser.query.simulcast !== 'false' || true;
	const useSharingSimulcast = urlParser.query.sharingSimulcast !== 'false' || true;
	const forceTcp = urlParser.query.forceTcp === 'true';
	const produce = urlParser.query.produce !== 'false';
	const consume = urlParser.query.consume !== 'false';
	const forceH264 = urlParser.query.forceH264 === 'true';
	const forceVP9 = urlParser.query.forceVP9 === 'true';
	const svc = urlParser.query.svc;
	const datachannel = urlParser.query.datachannel !== 'false';
	const info = urlParser.query.info === 'true';
	const faceDetection = urlParser.query.faceDetection === 'true'
	const externalVideo = urlParser.query.externalVideo === 'true' || true;
	const throttleSecret = urlParser.query.throttleSecret;
	

	
	// Enable face detection on demand.
	if (faceDetection)
		await faceapi.loadTinyFaceDetectorModel('/resources/face-detector-models');

	if (info) {
		// eslint-disable-next-line require-atomic-updates
		window.SHOW_INFO = true;
	}

	if (throttleSecret) {
		// eslint-disable-next-line require-atomic-updates
		window.NETWORK_THROTTLE_SECRET = throttleSecret;
	}
 
	// 	urlParser.query.roomId = roomId;
	// 	window.history.pushState('', '', urlParser.toString());
	// }

	// Get the effective/shareable Room URL.
	const roomUrlParser = new UrlParse(window.location.href, true);

	for (const key of Object.keys(roomUrlParser.query)) {
		// Don't keep some custom params.
		switch (key) {
			default:
				delete roomUrlParser.query[key];
		}
	}
	roomUrlParser.query['roomId']=roomId;
	delete roomUrlParser.hash;
	const roomUrl = roomUrlParser.toString();

	let displayNameSet;

	// If displayName was provided via URL or Cookie, we are done.
	if (displayName) {
		displayNameSet = true;
	}
	// Otherwise pick a random name and mark as "not set".
	else {
		displayNameSet = false;
		displayName = randomName();
		cookiesManager.setUser(displayName);
	}

	// Get current device info.
	const device = deviceInfo();

	store.dispatch(
		stateActions.setRoomUrl(roomUrl));

	store.dispatch(
		stateActions.setRoomFaceDetection(faceDetection));

	store.dispatch(
		stateActions.setMe({ peerId, displayName, displayNameSet, device }));

	roomClient = new RoomClient(
		{
			roomId,
			peerId,
			displayName,
			device,
			handlerName: handler,
			useSimulcast,
			useSharingSimulcast,
			forceTcp,
			produce,
			consume,
			forceH264,
			forceVP9,
			svc,
			datachannel,
			externalVideo
		
		});

	// NOTE: For debugging.
	window.CLIENT = roomClient; // eslint-disable-line require-atomic-updates
	window.CC = roomClient; // eslint-disable-line require-atomic-updates

	render(
		<Provider store={store}>
			<RoomContext.Provider value={roomClient}>
				{eleMain}
			</RoomContext.Provider>
		</Provider>,
		document.getElementById('mediasoup-demo-app-container')
	);
}

serviceWorker.unregister();
