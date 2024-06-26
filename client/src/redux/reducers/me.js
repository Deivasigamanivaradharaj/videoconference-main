const initialState =
{
	id                    : null,
	picture               : null,
	browser               : null,
	displayName			  :null,
	device				  :{},
	displayNameSet		  :false,
	roles                 : [ 'normal' ], // Default role
	canSendMic            : false,
	canSendWebcam         : false,
	canShareScreen        : false,
	canShareFiles         : false,
	audioDevices          : null,
	webcamDevices         : null,
	webcamInProgress      : false,
	audioInProgress       : false,
	screenShareInProgress : false,
	displayNameInProgress : false,
	loginEnabled          : false,
	raisedHand            : false,
	raisedHandInProgress  : false,
	loggedIn              : false,
	isSpeaking            : false,
	isAutoMuted           : true,
	isAudioLocked		  :false,
	isVideoLocked		  :false,
};

const me = (state = initialState, action) =>
{
	switch (action.type)
	{
		case 'SET_ME':
		{
			const {
				peerId,
				displayName,
				displayNameSet
			} = action.payload;

			return {
				...state,
				id : peerId,
				displayName,
				displayNameSet
			};
		}

		case 'SET_DEVICE':
		{
			const {
				device,
			
			} = action.payload;

			return {
				...state,
				device,
			
			};
		}

		case 'SET_BROWSER':
		{
			const { browser } = action.payload;

			return { ...state, browser };
		}

		case 'LOGGED_IN':
		{
			const { flag } = action.payload;

			return { ...state, loggedIn: flag };
		}

		case 'ADD_ROLE':
		{
			if (state.roles.includes(action.payload.role))
				return state;

			const roles = [ ...state.roles, action.payload.role ];

			return { ...state, roles };
		}

		case 'REMOVE_ROLE':
		{
			const roles = state.roles.filter((role) =>
				role !== action.payload.role);

			return { ...state, roles };
		}

		case 'SET_PICTURE':
			return { ...state, picture: action.payload.picture };

		case 'SET_MEDIA_CAPABILITIES':
		{
			const {
				canSendMic,
				canSendWebcam,
				canShareScreen,
				canShareFiles
			} = action.payload;

			return {
				...state,
				canSendMic,
				canSendWebcam,
				canShareScreen,
				canShareFiles
			};
		}

		case 'SET_AUDIO_DEVICES':
		{
			const { devices } = action.payload;

			return { ...state, audioDevices: devices };
		}

		case 'SET_AUDIO_OUTPUT_DEVICES':
		{
			const { devices } = action.payload;

			return { ...state, audioOutputDevices: devices };
		}

		case 'SET_WEBCAM_DEVICES':
		{
			const { devices } = action.payload;

			return { ...state, webcamDevices: devices };
		}

		case 'SET_AUDIO_IN_PROGRESS':
		{
			const { flag } = action.payload;

			return { ...state, audioInProgress: flag };
		}

		case 'SET_WEBCAM_IN_PROGRESS':
		{
			const { flag } = action.payload;

			return { ...state, webcamInProgress: flag };
		}

		case 'SET_SCREEN_SHARE_IN_PROGRESS':
		{
			const { flag } = action.payload;

			return { ...state, screenShareInProgress: flag };
		}

		case 'SET_RAISED_HAND':
		{
			const { flag } = action.payload;

			return { ...state, raisedHand: flag };
		}

		case 'SET_RAISED_HAND_IN_PROGRESS':
		{
			const { flag } = action.payload;

			return { ...state, raisedHandInProgress: flag };
		}

		case 'SET_DISPLAY_NAME_IN_PROGRESS':
		{
			const { flag } = action.payload;

			return { ...state, displayNameInProgress: flag };
		}

		case 'SET_IS_SPEAKING':
		{
			const { flag } = action.payload;

			return { ...state, isSpeaking: flag };
		}

		case 'SET_AUTO_MUTED':
		{
			const { flag } = action.payload;

			return { ...state, isAutoMuted: flag };
		}

		case 'SET_AUDIO_LOCKED':
		{
			const { flag } = action.payload;

			return { ...state, isAudioLocked: flag };
		}

		case 'SET_VIDEO_LOCKED':
		{
			const { flag } = action.payload;

			return { ...state, isVideoLocked: flag };
		}
		

		case 'SET_AUDIO_ONLY_STATE':
		{
			const { enabled } = action.payload;

			return { ...state, audioOnly: enabled };
		}

		default:
			return state;
	}
};

export default me;