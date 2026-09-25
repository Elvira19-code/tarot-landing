import {isIP} from 'node:net';

// Only the local reverse proxy may provide the client address.
export function clientIp(req, trustLocalProxy=false) {
 const peer=req.socket.remoteAddress;
 const forwarded=req.headers['x-real-ip'];
 if(trustLocalProxy&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)&&typeof forwarded==='string'&&isIP(forwarded))return forwarded;
 return peer;
}
