import React from 'react';
import { connect } from 'react-redux';
import * as appPropTypes from './appPropTypes';
import { withRoomContext } from '../RoomContext';
 import ScreenView from './ScreenView';

const StudentScreenView = (props) =>
{
	const {
		peer,
		videoConsumer,
	
	
	} = props;
	

	const videoVisible = (
		Boolean(videoConsumer) &&
		!videoConsumer.locallyPaused &&
		!videoConsumer.remotelyPaused 
	);

	return (
		<div data-component='ScreenView'   >
			{/* <div className='indicators'>
			
				
			</div> */}

			<ScreenView
					peer={peer}
					videoEnabled={videoVisible}
					audioConsumerId={null}
					videoConsumerId={videoConsumer ? videoConsumer.id : null}
					audioRtpParameters={null}
					videoRtpParameters={null}
					consumerSpatialLayers={null}
					consumerTemporalLayers={null}
					consumerCurrentSpatialLayer={
						videoConsumer ? videoConsumer.currentSpatialLayer : null
					}
					consumerCurrentTemporalLayer={
						videoConsumer ? videoConsumer.currentTemporalLayer : null
					}
					consumerPreferredSpatialLayer={
						videoConsumer ? videoConsumer.preferredSpatialLayer : null
					}
					consumerPreferredTemporalLayer={
						videoConsumer ? videoConsumer.preferredTemporalLayer : null
					}
					consumerPriority={videoConsumer ? videoConsumer.priority : null}
					audioTrack={ null}
					videoTrack={videoConsumer ? videoConsumer.track : null}
					audioMuted={true}
					videoVisible={videoVisible}
					videoMultiLayer={videoConsumer && videoConsumer.type !== 'simple'}
					audioCodec={null}
					videoCodec={videoConsumer ? videoConsumer.codec : null}
					audioScore={null}
					videoScore={videoConsumer ? videoConsumer.score : null}
					onChangeVideoPreferredLayers={(spatialLayer, temporalLayer) =>
					{
			 		}}
					onChangeVideoPriority={(priority) =>
					{
			 		}}
					onRequestKeyFrame={() =>
					{
			 		}}
					 
				
			/>
		</div>
	);
};

StudentScreenView.propTypes =
{
	peer             : appPropTypes.Peer,
	videoConsumer    : appPropTypes.Consumer,
	
	
};

const mapStateToProps = (state) =>
{
	const peersArray = Object.values(state.peers);

    const Orgaizer = peersArray.filter(peer => peer.id === peer.OrgazierPeerId)
    let peer;
	let videoConsumer;
    if(Orgaizer.length> 0){
		peer =Orgaizer[0];
		const consumersArray = peer.consumers
		.map((consumerId) => state.consumers[consumerId]);
		videoConsumer = consumersArray.find((consumer) => consumer.source==="share");

	}
	
	
	return {
		peer,
		videoConsumer
				
	};
};



const ScreenViewContainer = withRoomContext(connect(
	mapStateToProps,
    null
)(StudentScreenView));

export default ScreenViewContainer;
