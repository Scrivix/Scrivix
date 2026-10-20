/* Shared online-room transport for every question set. */
(function(root){const endpoint='https://matho-live.scrivix.us';root.MATHO_ROOM_SERVICE=Object.freeze({endpoint});root.MathoHttpsPeer.endpoint=endpoint;root.Peer=root.MathoHttpsPeer;})(globalThis);
