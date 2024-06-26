import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import * as appPropTypes from './appPropTypes';
import { Appear } from './transitions';
import Peer from './Peer';


const Peers = ({ peers, activeSpeakerId }) => {
	

	
		let	SelectedPeer = findPeerForStudent(peers,activeSpeakerId);
		
	 
	let singlePeer = SelectedPeer.length === 1;
	
	 
	return (

	<div data-component='PeersGrid' className="container-fluid inheritHeight">
			<div className="row h-100 center-content" >
			{
				peers.map((peer) => {
					return (
						<Appear  key={peer.id} duration={1000}>
						
								<div className= {classnames('item col-xs-12', {'col-12': singlePeer,'col-md-3 col-lg-3 col-sm-12 col-xs-12': !singlePeer,'d-none' : !HasPeer(peer.id,SelectedPeer)})} >
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

Peers.propTypes =
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

const PeersContainer = connect(
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
)(Peers);

export default PeersContainer;
