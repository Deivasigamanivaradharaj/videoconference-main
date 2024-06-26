import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import * as appPropTypes from './appPropTypes';
import { Appear } from './transitions';
import Peer from './Peer';


const AllPeersList = ({ peers, activeSpeakerId }) => {
	
	 

	
	 
	return (
		<div data-component='Peers' className="sidebar-item sidebar-menu">
			<ul >
			{
				peers.map((peer) => {
					return (
						<Appear  key={peer.id} duration={1000}>
						
								<li className= {classnames('item col-xs-12', {})} >
									<div
										className={classnames('peer-container', {
											'active-speaker':peer.id === activeSpeakerId 											
										})}
									>
										<Peer id={peer.id}  />
									</div>
								</li>
							 
						</Appear>
					);
				})
			}
			</ul>
		</div>
	);
};

AllPeersList.propTypes =
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


const AllPeersListContainer = connect(
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
)(AllPeersList);

export default AllPeersListContainer;
