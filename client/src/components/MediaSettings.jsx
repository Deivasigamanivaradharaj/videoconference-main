import React from 'react';
import { connect } from 'react-redux';
import * as appPropTypes from './appPropTypes';
import { withRoomContext } from '../RoomContext';
import * as settingsActions from '../redux/actions/settingsActions';
import PropTypes from 'prop-types';
import { Form,Accordion, } from 'react-bootstrap'
import Select from 'react-select';


const MediaSettings = ({
    setEchoCancellation,
    setAutoGainControl,
    setNoiseSuppression,
    setVoiceActivatedUnmute,
    roomClient,
    me,
    volume,
    settings,
    classes
}) => {



    const framerates = [{ value: 1, label: 1 }, { value: 5, label: 5 }, { value: 10, label: 10 }, { value: 15, label: 15 }, { value: 20, label: 20 }, { value: 25, label: 25 }, { value: 30, label: 30 }]
    const resolutions = [{
        value: 'low',
        label: 'Low'
    },
    {
        value: 'medium',
        label: 'Medium'
    },
    {
        value: 'high',
        label: 'High (HD)'
    },
    {
        value: 'veryhigh',
        label: 'Very high (FHD)'
    },
    {
        value: 'ultra',
        label: 'Ultra (UHD)'
    }];

    let webcams;

    if (me.webcamDevices)
        webcams = Object.values(me.webcamDevices);
    else
        webcams = [];



    let audioDevices;

    if (me.audioDevices)
        audioDevices = Object.values(me.audioDevices);
    else
        audioDevices = [];

    let audioOutputDevices;

    if (me.audioOutputDevices)
        audioOutputDevices = Object.values(me.audioOutputDevices);
    else
        audioOutputDevices = [];



    const customStyles = {
        menu: (provided, state) => ({
            position: 'relative'
        }),


    }
    function  SetSelectedValue (pOptions,Value,key ="value"){
      return pOptions.filter(function(option) {
            return option[key] === Value;
          })
    }
   

    return (
        <React.Fragment>
            <Form className='SettingsForm' autoComplete='off'>
                <Form.Group controlId="formCamera">
                    <Form.Label>Camera</Form.Label>
                    <Select id="formCamera" value={SetSelectedValue(webcams,settings.selectedWebcam,"deviceId")} styles={customStyles} name="Camera" options={webcams} onChange={(event) => {
                        console.log(event);
                        if (event.deviceId) {
                            roomClient.updateWebcam({
                                restart: true,
                                newDeviceId: event.deviceId
                            });
                        }
                    }} />
                    <Form.Text>
                        {webcams.length > 0 ? 'Select Camera' : 'Unable to select Camera'}
                    </Form.Text>


                </Form.Group>
                <Form.Group controlId="formavs">
                    <Accordion defaultActiveKey="0">
                        <Accordion.Toggle variant="link" eventKey="0">
                            Advance Video Settings
                       </Accordion.Toggle>
                        <Accordion.Collapse eventKey="0">
                            <React.Fragment>
                                <Form.Group controlId="formresolution">
                                    <Form.Label>Camera Resolution</Form.Label>
                                    <Select id="formresolution" value={SetSelectedValue(resolutions,settings.resolution)}   styles={customStyles} options={resolutions} onChange={(event) => {
                                      
                                        if (event.value) {
                                            roomClient.updateWebcam({ newResolution: event.value });
                                        }
                                    }} />
                                </Form.Group>
                                <Form.Group controlId="formframerate">
                                    <Form.Label>Camera Frame Rate</Form.Label>
                                    <Select id="formframeRate"   value={SetSelectedValue(framerates,settings.frameRate)}   styles={customStyles} options={framerates} onChange={(event) => {
                                      
                                        if (event.value) {
                                            roomClient.updateWebcam({ newFrameRate: event.value });
                                        }
                                    }} />
                                </Form.Group>
                                <Form.Group controlId="formssr">
                                    <Form.Label>ScreenSharing Resolution</Form.Label>
                                    <Select id="formssr"  value={SetSelectedValue(resolutions,settings.screenSharingResolution)} styles={customStyles} options={resolutions} onChange={(event) => {
                                        
                                        if (event.value) {
                                            roomClient.updateWebcam({ newResolution: event.value });
                                        }
                                    }} />
                                </Form.Group>
                                <Form.Group controlId="formssfr">
                                    <Form.Label>ScreenSharing Frame Rate</Form.Label>
                                    <Select id="formssfr"  value={SetSelectedValue(framerates,settings.screenSharingFrameRate)} styles={customStyles} options={framerates} onChange={(event) => {
                                        
                                        if (event.value) {
                                            roomClient.updateScreenSharing({ newFrameRate: event.value });
                                        }
                                    }} />
                                </Form.Group>
                            </React.Fragment>


                        </Accordion.Collapse>
                    </Accordion>
                </Form.Group>
                <Form.Group controlId="formaudioOutput">
                    <Form.Label>Speaker</Form.Label>
                    <Select id="formaudioOutput"  value={SetSelectedValue(audioOutputDevices,settings.selectedAudioOutputDevice,"deviceId")} styles={customStyles} options={audioOutputDevices} onChange={(event) => {
                        console.log(event);
                        if (event.deviceId) {
                            roomClient.changeAudioOutputDevice(event.deviceId);
                        }
                    }} />
                    <Form.Text>
                        {audioOutputDevices.length > 0 ? 'Select Speaker' : 'Unable to select Speaker'}
                    </Form.Text>

                </Form.Group>
                <Form.Group controlId="formaudioDevice">
                    <Form.Label>Mic</Form.Label>
                    <Select id="formaudioDevice" value={SetSelectedValue(audioDevices,settings.selectedAudioDevice,"deviceId")}  styles={customStyles} options={audioDevices} onChange={(event) => {
                        console.log(event);
                        if (event.deviceId) {
                            roomClient.updateMic({ restart: true, newDeviceId: event.deviceId });
                        }
                    }} />
                    <Form.Text>
                        {audioDevices.length > 0 ? 'Select mic' : 'Unable to select Mic'}
                    </Form.Text>



                </Form.Group>
               
            </Form>
        </React.Fragment>
    );
};

MediaSettings.propTypes =
{
    roomClient: PropTypes.any.isRequired,
    setEchoCancellation: PropTypes.func.isRequired,
    setAutoGainControl: PropTypes.func.isRequired,
    setNoiseSuppression: PropTypes.func.isRequired,
    setVoiceActivatedUnmute: PropTypes.func.isRequired,
    me: appPropTypes.Me.isRequired,
    volume: PropTypes.number,
    settings: PropTypes.object.isRequired
};

const mapStateToProps = (state) => {
    return {
        me: state.me,
        volume: state.peerVolumes[state.me.id],
        settings: state.settings
    };
};

const mapDispatchToProps = {
    setEchoCancellation: settingsActions.setEchoCancellation,
    setAutoGainControl: settingsActions.setAutoGainControl,
    setNoiseSuppression: settingsActions.setNoiseSuppression,
    setVoiceActivatedUnmute: settingsActions.setVoiceActivatedUnmute
};

export default withRoomContext(connect(
    mapStateToProps,
    mapDispatchToProps,
    null,
    {
        areStatesEqual: (next, prev) => {
            return (
                prev.me === next.me &&
                prev.settings === next.settings &&
                prev.peerVolumes[prev.me.id] === next[next.me.id]
            );
        }
    }
)(MediaSettings));