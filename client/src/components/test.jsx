<header className="page-header">
<nav className="buttons navbar-light border-bottom">
    <div id="navbarSupportedContent">
         {/* <p className="font-weight-bold" > Active Speaker :</p>*/}
        <Button className="togglesettings d-sm-inline-block d-xs-inline-block d-md-none d-lg-none" onClick={this.onClick} ><FontAwesomeIcon icon="th" size="1x" > </FontAwesomeIcon></Button>
        <Button className="togglesettings d-none d-xs-none d-sm-none d-md-block d-lg-block" onClick={this.onClick} ><FontAwesomeIcon icon="th" size="md" > </FontAwesomeIcon></Button>
    
        <div className={classnames('stateicon', room.state)} > 
                    {me.displayName.substring(0, 2)}
        </div>
        <Button className="Leave d-sm-inline-block d-xs-inline-block d-md-none d-lg-none "  variant="outline-danger" disabled={room.closeMeetingInProgress} data-toggle="Close Meeting" title="Close Meeting" onClick={onCloseClick}  ><FontAwesomeIcon icon="window-close" size="1x" > </FontAwesomeIcon></Button>
        <Button className="Leave d-none d-xs-none d-sm-none d-md-block d-lg-block"  variant="outline-danger" disabled={room.closeMeetingInProgress}  data-toggle="Close Meeting" title="Close Meeting" onClick={onCloseClick}  >Close</Button>
     </div>
</nav>

<div className="bg-light " id="sidebar-wrapper">
<div className="sidebar-heading"><p className="text-uppercase">{window.ROOM_ID}</p> </div>
{/* <div className="full-width-tabs">
 <Tabs defaultActiveKey="Me"  >
     <Tab eventKey="Me" title="Me" >

         <div className='remoteoptions'>
                 <MediaSettings/>  
         </div>
     </Tab>
    
     <Tab eventKey="Remote" title="Remote">
         <RemoteControls/>
     </Tab>
 </Tabs>
</div> */}
</div> 
</header>

const videoProducer =
		producersArray.find((producer) => producer.track.kind === 'video' && producer.type === 'share');
