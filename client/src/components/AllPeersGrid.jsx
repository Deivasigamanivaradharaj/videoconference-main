import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import * as appPropTypes from './appPropTypes';
import { Appear } from './transitions';
import Peer from './Peer';


const AllPeersGrid = ({ peers, activeSpeakerId }) => {
	
	 
	let singlePeer = peers.length === 1;
	
	 
	return (
		<div data-component='PeersGrid' className="container-fluid inheritHeight">
			<div className="row h-100 center-content" >
			{
				peers.map((peer) => {
					return (
						<Appear  key={peer.id} duration={1000}>
						
								<div className= {classnames('item', {'col-12': singlePeer,'col-md-3 col-lg-3 col-sm-12 col-xs-12': !singlePeer})} >
									<div
										className={classnames('peer-container', {
											'active-speaker':peer.id === activeSpeakerId ,
											singlePeer: singlePeer,
										})}
									>
										<Peer id={peer.id}  />
									</div>
								</div>
							 
						</Appear>
					);
				})
			}
			</div>
		</div>
	);
};

AllPeersGrid.propTypes =
{
	peers: PropTypes.arrayOf(appPropTypes.Peer),
	activeSpeakerId: PropTypes.string
	
};

const mapStateToProps = (state) => {
	const peersArray = Object.values(state.peers).sort(function(a,b){
		if(a.id === state.room.activeSpeakerId) return -1;
		return 1;
	});;

	return {
		peers: peersArray,
		activeSpeakerId: state.room.activeSpeakerId
	};
};


const AllPeersGridContainer = connect(
	mapStateToProps,
	null,
	null,
	{
		areStatesEqual: (next, prev) => {
			return (
				prev.peers === next.peers &&
				prev.room.activeSpeakerId === next.room.activeSpeakerId
			);
		}
	}
)(AllPeersGrid);

export default AllPeersGridContainer;
