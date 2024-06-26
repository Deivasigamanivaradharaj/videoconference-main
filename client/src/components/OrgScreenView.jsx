import React from 'react';
import { connect } from 'react-redux';
import * as appPropTypes from './appPropTypes';
import { withRoomContext } from '../RoomContext';
import ScreenView from './ScreenView';

const OrgScreenView = (props) =>
{
	const {
		videoProducer,
        me
	
	} = props;
	
	const videoVisible = Boolean(videoProducer) && !videoProducer.paused;


	return (
		<div data-component='ScreenView'    >
		       <ScreenView
					isMe = {true}
					peer={me}
					audioProducerId={null}
					videoProducerId={videoProducer ? videoProducer.id : null}
					audioRtpParameters={null}
					videoRtpParameters={videoProducer ? videoProducer.rtpParameters : null}
					audioTrack={null}
					videoTrack={videoProducer ? videoProducer.track : null}
					videoVisible={videoVisible}
					audioCodec={null}
					videoCodec={videoProducer ? videoProducer.codec : null}
					audioScore={null}
					videoScore={videoProducer ? videoProducer.score : null}
					faceDetection={null}
					onChangeDisplayName={(displayName) => {
						
					}}
					onChangeMaxSendingSpatialLayer={(spatialLayer) => {
					
					}}
				
				/>
		</div>
	);
};

OrgScreenView.propTypes =
{
	peer             : appPropTypes.Peer,
	videoProducer    : appPropTypes.Producer,
    me: appPropTypes.Me.isRequired,
	
};

const mapStateToProps = (state) =>
{
	const me = state.me;
  

    const producersArray = Object.values(state.producers);

        const videoProducer =
		producersArray.find((producer) => producer.track.kind === 'video' && producer.type === 'share');

	 
	return {
		videoProducer,
		me		
	};
};



const OrgScreenViewContainer = withRoomContext(connect(
	mapStateToProps,
    null
)(OrgScreenView));

export default OrgScreenViewContainer;
