import React from 'react';
import { connect } from 'react-redux';
import * as appPropTypes from './appPropTypes';
import { withRoomContext } from '../RoomContext';
import PropTypes from 'prop-types';
import { Form, } from 'react-bootstrap'



const RemoteControls = ({
      roomClient,
    room
  }) => {

    const onVideoSwitchAction = () => {
        room.isVideoAllLocked
        ? roomClient.playAllPeerVideo()
        : roomClient.stopAllPeerVideo();
      };



    const onAudioSwitchAction = () => {
        room.isAudioAllLocked
        ? roomClient.unmuteAllPeers()
        : roomClient.muteAllPeers();
      };
    

    return (
        <React.Fragment>
            <Form className='RemoteControlsForm' autoComplete='off'>
                <Form.Group controlId="formRemoteVideo">
                    <Form.Label>Remote Video</Form.Label>
                    <Form.Check type="switch"  checked={room.isVideoAllLocked}  id="custom-Video"  onChange={onVideoSwitchAction} label={room.isVideoAllLocked ? "Unlock Video" : "Lock Video"} />      

                </Form.Group>
                <Form.Group controlId="formRemoteAudio">
                    <Form.Label>Remote Audio</Form.Label>
                    <Form.Check type="switch"  checked={room.isAudioAllLocked}  id="custom-Audio"  onChange={onAudioSwitchAction} label={room.isAudioAllLocked ? "Unlock Audio" : "Lock Audio"}/>      

                </Form.Group>
            </Form>
        </React.Fragment>
    );
};

RemoteControls.propTypes =
{
    roomClient: PropTypes.any.isRequired,
    room: appPropTypes.Room.isRequired,
 
};

const mapStateToProps = (state) => {
    return {
        room: state.room
         
    };
};

export default withRoomContext(connect(
    mapStateToProps,
    null,
    null,
    {
        areStatesEqual: (next, prev) => {
            return (
                prev.room === next.room
            );
        }
    }
)(RemoteControls));