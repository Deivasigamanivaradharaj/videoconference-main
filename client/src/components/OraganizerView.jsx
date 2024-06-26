import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import * as appPropTypes from './appPropTypes';
import { withRoomContext } from '../RoomContext';
import * as requestActions from '../redux/requestActions';
import { Appear } from './transitions';
import Me from './Me';
import AllPeersGrid from './AllPeersGrid';
import AllPeersList from './AllPeersList';
import Notifications from './Notifications';
import { Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { confirm } from 'react-bootstrap-confirmation';
import { Scrollbars } from 'react-custom-scrollbars'
import  OrgScreenView from './OrgScreenView';
import { Tabs, Tab } from 'react-bootstrap';

import MediaSettings from './MediaSettings';

import RemoteControls from './RemoteControls';

class OrginzerView extends React.Component {


    state = {
        toggled: true,
    }

    onClick = () => {
        this.setState({
            toggled: !this.state.toggled
          
        });


    }

    render() {
        const {
           
            roomClient,
            room,
            me,
            amActiveSpeaker,
            ScreenShared
        } = this.props;


        const onCloseClick = async () => {
            const result = await confirm('Are you really sure want to close?');
            if (result) {
                roomClient.closeMeeting()
            }
        }


            let eleSideBarView=null;
            let eleCenterView=null;

            if(ScreenShared){
                eleSideBarView= <AllPeersList/>
                eleCenterView= < OrgScreenView/>
            }
            else{
                eleCenterView=  <AllPeersGrid/>
            }




       

        return (
            <Appear duration={300}>
                <div data-component='PageView' className={classnames('page-wrapper', { 'toggled': this.state.toggled })}>
                    <Notifications />
                    <nav id="sidebar" className={classnames('sidebar-wrapper')}>
                        <Scrollbars autoHide
                            autoHideTimeout={300}
                            autoHideDuration={100}
                            thumbMinSize={20}
                            universal={true} style={{ position: 'relative' }} >
                            <div class="sidebar-content" >
                                <div class="sidebar-item sidebar-brand">
                                    <a href="# ">Online Tutor</a>
                                </div>
                                <div className="full-width-tabs">
                                    <Tabs defaultActiveKey="Me"  >
                                        <Tab eventKey="Me" title="Me">
                                                <div class="sidebar-item sidebar-header d-flex flex-nowrap">
                                                 <div className={classnames('me-container', { 'active-speaker': amActiveSpeaker })}>
                                                <Me />
                                                 </div>
                                             </div>

                                         {eleSideBarView}
                                        </Tab>
                                        <Tab eventKey="Settings" title="Settings" >

                                            <div className='remoteoptions'>
                                                    <MediaSettings/>  
                                            </div>
                                        </Tab>
                                        
                                        <Tab eventKey="Remote" title="Remote">
                                            <RemoteControls/>
                                        </Tab>
                                    </Tabs>
                                    </div>
                                                       

                            </div>
                        </Scrollbars>
                    

                    </nav>

                    <main className="page-content pt-2">
                        <div className="container-fluid inheritHeight">
                            <div class="row">
                                <div className="header pl-1 pr-1">
                                    <Button className="togglesettings d-sm-inline-block d-xs-inline-block d-md-none d-lg-none" onClick={this.onClick} ><FontAwesomeIcon icon="th" size="1x" > </FontAwesomeIcon></Button>
                                    <Button className="togglesettings d-none d-xs-none d-sm-none d-md-block d-lg-block" onClick={this.onClick} ><FontAwesomeIcon icon="th" size="md" > </FontAwesomeIcon></Button>

                                    <div className={classnames('stateicon', room.state)} >
                                        {me.displayName.substring(0, 2)}
                                    </div>
                                    <Button className="Leave d-sm-inline-block d-xs-inline-block d-md-none d-lg-none " variant="outline-danger" disabled={room.closeMeetingInProgress} data-toggle="Close Meeting" title="Close Meeting" onClick={onCloseClick}  ><FontAwesomeIcon icon="window-close" size="1x" > </FontAwesomeIcon></Button>
                                    <Button className="Leave d-none d-xs-none d-sm-none d-md-block d-lg-block" variant="outline-danger" disabled={room.closeMeetingInProgress} data-toggle="Close Meeting" title="Close Meeting" onClick={onCloseClick}  >Close</Button>
                                </div>
                            </div>
                           {eleCenterView}
                        </div>

                    </main>
                </div>

            </Appear>
        );
    }

    componentDidMount() {
        const { roomClient } = this.props;
        
        roomClient.join({ roomId: window.ROOM_ID, joinVideo: false });
    }
}

OrginzerView.propTypes =
{
    connected: PropTypes.bool,
    roomClient: PropTypes.any.isRequired,
    room: appPropTypes.Room.isRequired,
    me: appPropTypes.Me.isRequired,
    amActiveSpeaker: PropTypes.bool.isRequired,
    onRoomLinkCopy: PropTypes.func.isRequired,
    ScreenShared:PropTypes.bool
};

const mapStateToProps = (state) => {
 let ScreenShared= false;
 const producersArray = Object.values(state.producers);

 const videoProducer =
 producersArray.find((producer) => producer.track.kind === 'video' && producer.type === 'share');

 if(videoProducer){
    ScreenShared  = true;
 }
    return {
        connected: state.room.state === 'connected',
        room: state.room,
        me: state.me,
        amActiveSpeaker: state.me.id === state.room.activeSpeakerId,
        ScreenShared
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onRoomLinkCopy: () => {
            dispatch(requestActions.notify(
                {
                    text: 'Room link copied to the clipboard'
                }));
        }
    };
};

const OrginzerViewContainer = withRoomContext(connect(
    mapStateToProps,
    mapDispatchToProps
)(OrginzerView));

export default OrginzerViewContainer;
