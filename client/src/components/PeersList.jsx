import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import * as appPropTypes from './appPropTypes';
import { Appear } from './transitions';
import Peer from './Peer';


const PeersList = ({ peers, activeSpeakerId }) => {
	

	
		let	SelectedPeer = findPeerForStudent(peers,activeSpeakerId);
	
	
	
	 
	return (

	<div data-component='Peers' className="sidebar-item sidebar-menu">
			<ul >
			{
				peers.map((peer) => {
					return (
						<Appear  key={peer.id} duration={1000}>
						
								<li className= {classnames('item col-xs-12', {'d-none' : !HasPeer(peer.id,SelectedPeer)})} >
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

PeersList.propTypes =
{
	peers: PropTypes.arrayOf(appPropTypes.Peer),
	activeSpeakerId: PropTypes.string,
	isStudentView:PropTypes.bool
};

const mapStateToProps = (state) => {
	const peersArray = Object.values(state.peers);

	return {
		peers: peersArray,
		activeSpeakerId: state.room.activeSpeakerId
	};
};

const findPeerForStudent  = (peers) =>{
	let result = []
    let Orgaizer = peers.filter(peer => peer.id === peer.OrgazierPeerId)

	// let ActiveSpeaker=peers.filter(peer => peer.id === activeSpeakerId)

	// if(ActiveSpeaker.length >0 ){
	// 	result.push(ActiveSpeaker[0])
	// }
    if(Orgaizer.length > 0){
		result.push(Orgaizer[0])
	}

	return  result
}


const HasPeer  = (peerId,SelectedPeers) =>{
	
	 let PeerObj=SelectedPeers.filter( peer => peer.id ===  peerId )		
	return (PeerObj.length  > 0)
}

const PeersListContainer = connect(
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
)(PeersList);

export default PeersListContainer;
