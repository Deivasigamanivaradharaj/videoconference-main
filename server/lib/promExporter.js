const { Resolver } = require('dns').promises;
const express = require('express');
const prom = require('prom-client');

const Logger = require('./Logger');

const childLogger =  Logger.child({ requestId: '456' }) //new Logger('prom');
const resolver = new Resolver();
const workers = new Map();

const labelNames = [
	'pid', 'room_id', 'peer_id', 'display_name', 'user_agent', 'transport_id',
	'proto', 'local_addr', 'remote_addr', 'id', 'kind', 'codec', 'type'
];

const metadata = {
	'byteCount' : { metricType: prom.Counter, unit: 'bytes' },
	'score'     : { metricType: prom.Gauge }
};

module.exports = async function(rooms, peers, config)
{
	const collect = async function(registry)
	{
		const newMetrics = function(subsystem)
		{
			const namespace = 'VideoChat';
			const metrics = new Map();

			for (const key in metadata)
			{
				if (Object.prototype.hasOwnProperty.call(metadata, key))
				{
					const value = metadata[key];
					const name = key.split(/(?=[A-Z])/).join('_')
						.toLowerCase();
					const unit = value.unit;
					const metricType = value.metricType;
					let s = `${namespace}_${subsystem}_${name}`;

					if (unit)
					{
						s += `_${unit}`;
					}
					const m = new metricType({
						name : s, help : `${subsystem}.${key}`, labelNames : labelNames, registers : [ registry ] });

					metrics.set(key, m);
				}
			}

			return metrics;
		};

		const commonLabels = function(both, fn)
		{
			for (const roomId of rooms.keys())
			{
				for (const [ peerId, peer ] of peers)
				{
					if (fn(peer))
					{
						const displayName = peer._displayName;
						const userAgent = peer._socket.client.request.headers['user-agent'];
						const kind = both.kind;
						const codec = both.rtpParameters.codecs[0].mimeType.split('/')[1];

						return { roomId, peerId, displayName, userAgent, kind, codec };
					}
				}
			}
			throw new Error('cannot find common labels');
		};

		const addr = async function(ip, port)
		{
			if (config.deidentify)
			{
				const a = ip.split('.');

				for (let i = 0; i < a.length - 2; i++)
				{
					a[i] = 'xx';
				}

				return `${a.join('.')}:${port}`;
			}
			else if (config.numeric)
			{
				return `${ip}:${port}`;
			}
			else
			{
				try
				{
					const a = await resolver.reverse(ip);

					ip = a[0];
				}
				catch (err)
				{
					childLogger.error(`reverse DNS query failed: ${ip} ${err.code}`);
				}

				return `${ip}:${port}`;
			}
		};

		const quiet = function(s)
		{
			return config.quiet ? '' : s;
		};

		const setValue = function(key, m, labels, v)
		{
			childLogger.debug(`setValue key=${key} v=${v}`);
			switch (metadata[key].metricType)
			{
				case prom.Counter:
					m.inc(labels, v);
					break;
				case prom.Gauge:
					m.set(labels, v);
					break;
				default:
					throw new Error(`unexpected metric: ${m}`);
			}
		};

		childLogger.debug('collect');
		const mRooms = new prom.Gauge({ name: 'dlc_rooms', help: '#rooms', registers: [ registry ] });

		mRooms.set(rooms.size);
		const mPeers = new prom.Gauge({ name: 'dlc_peers', help: '#peers', labelNames: [ 'room_id' ], registers: [ registry ] });

		for (const [ roomId, room ] of rooms)
		{
			mPeers.labels(roomId).set(Object.keys(room._peers).length);
		}

		const mConsumer = newMetrics('consumer');
		const mProducer = newMetrics('producer');

		for (const [ pid, worker ] of workers)
		{
			childLogger.debug(`visiting worker ${pid}`);
			for (const router of worker._routers)
			{
				childLogger.debug(`visiting router ${router.id}`);
				for (const [ transportId, transport ] of router._transports)
				{
					childLogger.debug(`visiting transport ${transportId}`);
					const transportJson = await transport.dump();

					if (transportJson.iceState != 'completed')
					{
						childLogger.debug(`skipping transport ${transportId}}: ${transportJson.iceState}`);
						continue;
					}
					const iceSelectedTuple = transportJson.iceSelectedTuple;
					const proto = iceSelectedTuple.protocol;
					const localAddr = await addr(iceSelectedTuple.localIp,
						iceSelectedTuple.localPort);
					const remoteAddr = await addr(iceSelectedTuple.remoteIp,
						iceSelectedTuple.remotePort);

					for (const [ producerId, producer ] of transport._producers)
					{
						childLogger.debug(`visiting producer ${producerId}`);
						const { roomId, peerId, displayName, userAgent, kind, codec } =
							commonLabels(producer, (peer) => peer._producers.has(producerId));
						const a = await producer.getStats();

						for (const x of a)
						{
							const type = x.type;
							const labels = {
								'pid'          : pid,
								'room_id'      : roomId,
								'peer_id'      : peerId,
								'display_name' : displayName,
								'user_agent'   : userAgent,
								'transport_id' : quiet(transportId),
								'proto'        : proto,
								'local_addr'   : localAddr,
								'remote_addr'  : remoteAddr,
								'id'           : quiet(producerId),
								'kind'         : kind,
								'codec'        : codec,
								'type'         : type
							};

							for (const [ key, m ] of mProducer)
							{
								setValue(key, m, labels, x[key]);
							}
						}
					}
					for (const [ consumerId, consumer ] of transport._consumers)
					{
						childLogger.debug(`visiting consumer ${consumerId}`);
						const { roomId, peerId, displayName, userAgent, kind, codec } =
							commonLabels(consumer, (peer) => peer._consumers.has(consumerId));
						const a = await consumer.getStats();

						for (const x of a)
						{
							if (x.type == 'inbound-rtp')
							{
								continue;
							}
							const type = x.type;
							const labels =
							{
								'pid'          : pid,
								'room_id'      : roomId,
								'peer_id'      : peerId,
								'display_name' : displayName,
								'user_agent'   : userAgent,
								'transport_id' : quiet(transportId),
								'proto'        : proto,
								'local_addr'   : localAddr,
								'remote_addr'  : remoteAddr,
								'id'           : quiet(consumerId),
								'kind'         : kind,
								'codec'        : codec,
								'type'         : type
							};

							for (const [ key, m ] of mConsumer)
							{
								setValue(key, m, labels, x[key]);
							}
						}
					}
				}
			}
		}
	};

	try
	{
		childLogger.debug(`config.deidentify=${config.deidentify}`);
		childLogger.debug(`config.numeric=${config.numeric}`);
		childLogger.debug(`config.port=${config.port}`);
		childLogger.debug(`config.quiet=${config.quiet}`);


		const app = express();

		app.get('/', async (req, res) =>
		{
			childLogger.debug(`GET ${req.originalUrl}`);
			const registry = new prom.Registry();

			await collect(registry);
			res.set('Content-Type', registry.contentType);
			const data = registry.metrics();

			res.end(data);
		});
		const server = app.listen(config.port || 8889, () =>
		{
			const address = server.address();

			childLogger.info(`listening ${address.address}:${address.port}`);
		});
	}
	catch (err)
	{
		childLogger.error(err);
	}
};
