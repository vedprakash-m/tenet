// Spike B item 3: Ed25519 with node:crypto, key in an env secret (PEM), verifying with the pinned public half.
import crypto from 'node:crypto';
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const secretPem = privateKey.export({ type: 'pkcs8', format: 'pem' });           // what goes into the CI secret
const pinned = publicKey.export({ type: 'spki', format: 'der' }).toString('base64'); // what goes into tenet.yaml
const record = Buffer.from(JSON.stringify({ id: 'ev1', subject: 'sha256:abc', result: 'pass' })); // stands in for RFC 8785 bytes
const sig = crypto.sign(null, record, crypto.createPrivateKey(secretPem));
const pub = crypto.createPublicKey({ key: Buffer.from(pinned, 'base64'), format: 'der', type: 'spki' });
console.log('signature bytes', sig.length, 'verifies', crypto.verify(null, record, pub, sig));
const tampered = Buffer.from(record.toString().replace('pass', 'fail'));
console.log('tampered verifies', crypto.verify(null, tampered, pub, sig));
console.log('pinned public key length (base64)', pinned.length);
