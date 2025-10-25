import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  
  if (!secret) {
    throw new Error(
      'ENCRYPTION_SECRET environment variable is required for credential encryption. ' +
      'Please set a strong, random secret key (minimum 32 characters) in your environment variables.'
    );
  }
  
  if (secret.length < 32) {
    throw new Error(
      'ENCRYPTION_SECRET must be at least 32 characters long for secure encryption. ' +
      'Current length: ' + secret.length
    );
  }
  
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptCredentials(credentials: Record<string, string>): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const plaintext = JSON.stringify(credentials);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  const result = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'hex')
  ]).toString('base64');
  
  return result;
}

export function decryptCredentials(encryptedData: string): Record<string, string> {
  try {
    const key = getEncryptionKey();
    const buffer = Buffer.from(encryptedData, 'base64');
    
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Error decrypting credentials:', error);
    throw new Error('Failed to decrypt credentials');
  }
}
