const EventEmitter = require('events').EventEmitter;
const Logger = require('./Logger');

const childLogger =  Logger.child({ requestId: '452' })// new Logger('Lobby');

class Lobby extends EventEmitter
{
	constructor()
	{
		childLogger.info('constructor()');

		super();

		// Closed flag.
		this._closed = false;

		this._peers = {};
	}

	close()
	{
		childLogger.info('close()');

		this._closed = true;

		// Close the peers.
		for (const peer in this._peers)
		{
			if (!this._peers[peer].closed)
				this._peers[peer].close();
		}

		this._peers = null;
	}

	checkEmpty()
	{
		childLogger.info('checkEmpty()');

		return Object.keys(this._peers).length === 0;
	}

	peerList()
	{
		childLogger.info('peerList()');

		return Object.values(this._peers).map((peer) =>
			({
				id          : peer.id,
				displayName : peer.displayName,
				picture     : peer.picture
			}));
	}

	hasPeer(peerId)
	{
		return this._peers[peerId] != null;
	}

	promoteAllPeers()
	{
		childLogger.info('promoteAllPeers()');

		for (const peer in this._peers)
		{
			if (!this._peers[peer].closed)
				this.promotePeer(peer);
		}
	}

	promotePeer(peerId)
	{
		childLogger.info('promotePeer() [peer:"%s"]', peerId);

		const peer = this._peers[peerId];

		if (peer)
		{
			peer.socket.removeListener('request', peer.socketRequestHandler);
			peer.removeListener('gotRole', peer.gotRoleHandler);
			peer.removeListener('displayNameChanged', peer.displayNameChangeHandler);
			peer.removeListener('pictureChanged', peer.pictureChangeHandler);
			peer.removeListener('close', peer.closeHandler);

			peer.socketRequestHandler = null;
			peer.gotRoleHandler = null;
			peer.displayNameChangeHandler = null;
			peer.pictureChangeHandler = null;
			peer.closeHandler = null;

			this.emit('promotePeer', peer);
			delete this._peers[peerId];
		}
	}

	parkPeer(peer)
	{
		childLogger.info('parkPeer() [peer:"%s"]', peer.id);

		if (this._closed)
			return;

		peer.socketRequestHandler = (request, cb) =>
		{
			childLogger.debug(
				'Peer "request" event [method:"%s", peer:"%s"]',
				request.method, peer.id);

			if (this._closed)
				return;

			this._handleSocketRequest(peer, request, cb)
				.catch((error) =>
				{
					childLogger.error('request failed [error:"%o"]', error);

					cb(error);
				});
		};

		peer.gotRoleHandler = () =>
		{
			childLogger.info('parkPeer() | rolesChange [peer:"%s"]', peer.id);

			this.emit('peerRolesChanged', peer);
		};

		peer.displayNameChangeHandler = () =>
		{
			childLogger.info('parkPeer() | displayNameChange [peer:"%s"]', peer.id);

			this.emit('changeDisplayName', peer);
		};

		peer.pictureChangeHandler = () =>
		{
			childLogger.info('parkPeer() | pictureChange [peer:"%s"]', peer.id);

			this.emit('changePicture', peer);
		};

		peer.closeHandler = () =>
		{
			childLogger.debug('Peer "close" event [peer:"%s"]', peer.id);

			if (this._closed)
				return;

			this.emit('peerClosed', peer);

			delete this._peers[peer.id];

			if (this.checkEmpty())
				this.emit('lobbyEmpty');
		};

		this._peers[peer.id] = peer;

		peer.on('gotRole', peer.gotRoleHandler);
		peer.on('displayNameChanged', peer.displayNameChangeHandler);
		peer.on('pictureChanged', peer.pictureChangeHandler);

		peer.socket.on('request', peer.socketRequestHandler);

		peer.on('close', peer.closeHandler);

		this._notification(peer.socket, 'enteredLobby');
	}

	async _handleSocketRequest(peer, request, cb)
	{
		childLogger.debug(
			'_handleSocketRequest [peer:"%s"], [request:"%s"]',
			peer.id,
			request.method
		);

		if (this._closed)
			return;

		switch (request.method)
		{
			case 'changeDisplayName':
			{
				const { displayName } = request.data;

				peer.displayName = displayName;

				cb();

				break;
			}

			case 'changePicture':
			{
				const { picture } = request.data;

				peer.picture = picture;

				cb();

				break;
			}
		}
	}

	_notification(socket, method, data = {}, broadcast = false)
	{
		if (broadcast)
		{
			socket.broadcast.to(this._roomId).emit(
				'notification', { method, data }
			);
		}
		else
		{
			socket.emit('notification', { method, data });
		}
	}
}

module.exports = Lobby;