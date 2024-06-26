let mediaQueryDetectorElem;

export function initialize()
{
	// Media query detector stuff.
	mediaQueryDetectorElem =
		document.getElementById('mediasoup-demo-app-media-query-detector');

	return Promise.resolve();
}

export function isDesktop()
{
	return Boolean(mediaQueryDetectorElem.offsetParent);
}

export function isMobile()
{
	return !mediaQueryDetectorElem.offsetParent;
}


export const idle = (callback, delay) =>
{
	let handle;

	return () =>
	{
		if (handle)
		{
			clearTimeout(handle);
		}

		handle = setTimeout(callback, delay);
	};
};

/**
 * Error produced when a socket request has a timeout.
 */
export class SocketTimeoutError extends Error
{
	constructor(message)
	{
		super(message);

		this.name = 'SocketTimeoutError';

		if (Error.hasOwnProperty('captureStackTrace')) // Just in V8.
			Error.captureStackTrace(this, SocketTimeoutError);
		else
			this.stack = (new Error(message)).stack;
	}
}