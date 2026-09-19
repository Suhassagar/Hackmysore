const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 5MB maximum file size
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Validates magic numbers to ensure file type is genuinely JPEG, PNG, or WEBP,
 * rather than relying solely on client-reported headers or extensions.
 */
function validateMagicBytes(buffer) {
  if (!buffer || buffer.length < 12) return false;

  const hex = buffer.toString('hex', 0, 12);

  // JPEG: FF D8 FF
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (hex.startsWith('89504e47')) return 'image/png';

  // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') {
    return 'image/webp';
  }

  return false;
}

class MediaStorageService {
  /**
   * Validate image buffer, size, and magic bytes.
   */
  validateImage(buffer, claimedMimeType = '') {
    if (!buffer || buffer.length === 0) {
      throw new Error('Image data is empty');
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Image size exceeds 5MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)}MB).`);
    }

    const detectedMime = validateMagicBytes(buffer);
    if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
      throw new Error('Unsupported image format. Allowed formats: JPEG, PNG, WEBP.');
    }

    if (claimedMimeType && claimedMimeType.toLowerCase() !== detectedMime) {
      // In case client claimed jpg but magic bytes detected png or vice versa
      console.warn(`[Storage] MIME type mismatch: claimed '${claimedMimeType}', detected '${detectedMime}'`);
    }

    return detectedMime;
  }

  /**
   * Upload image buffer or data URL to storage.
   * Returns public URL for storing in database.
   */
  async upload(imageInput, claimedMime = '') {
    let buffer;
    let mimeType = claimedMime;

    if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
      // Data URI format: data:image/jpeg;base64,...
      const matches = imageInput.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid base64 image data URI format');
      }
      mimeType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
    } else if (Buffer.isBuffer(imageInput)) {
      buffer = imageInput;
    } else {
      throw new Error('Unsupported image input format. Expected Buffer or data URI string.');
    }

    // Strict validation
    const verifiedMime = this.validateImage(buffer, mimeType);

    const extMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const extension = extMap[verifiedMime] || '.jpg';
    const filename = `civic-report-${Date.now()}-${uuidv4()}${extension}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    await fs.promises.writeFile(filePath, buffer);

    // Return the relative URL reference
    return `/uploads/${filename}`;
  }

  /**
   * Delete an uploaded file
   */
  async delete(fileUrl) {
    if (!fileUrl || !fileUrl.startsWith('/uploads/')) return;
    const filename = path.basename(fileUrl);
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  getUrl(fileUrl) {
    return fileUrl;
  }
}

module.exports = new MediaStorageService();
