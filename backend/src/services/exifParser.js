/**
 * CivicFlow — Phase 3B: Photo Evidence Validation & Pure-JS EXIF Inspector
 * 
 * Goals:
 * 1. Self-contained binary JPEG parser (0 external dependencies).
 * 2. Parses APP1 (0xFFE1) marker, TIFF header (both Little Endian 'II' and Big Endian 'MM'),
 *    IFD0, Exif SubIFD (DateTimeOriginal), and GPS SubIFD (Latitude, Longitude).
 * 3. Compares extracted GPS coordinates with citizen-reported coordinates using Haversine formula.
 * 4. Flags >500m discrepancies as LOCATION_MISMATCH so human review can assess evidence.
 * 5. Calmly handles images with stripped metadata as VALID_NO_METADATA without treating citizens as fraudsters.
 */

const PHOTO_STATUS = Object.freeze({
  VALID: 'VALID',
  VALID_NO_METADATA: 'VALID_NO_METADATA',
  LOCATION_MISMATCH: 'LOCATION_MISMATCH',
  TIMESTAMP_MISMATCH: 'TIMESTAMP_MISMATCH',
  INVALID_FILE: 'INVALID_FILE',
});

function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

class ExifReader {
  constructor(buffer) {
    this.buf = buffer;
    this.isLittleEndian = true;
  }

  readUint16(offset) {
    if (offset + 2 > this.buf.length) return 0;
    return this.isLittleEndian
      ? this.buf.readUInt16LE(offset)
      : this.buf.readUInt16BE(offset);
  }

  readUint32(offset) {
    if (offset + 4 > this.buf.length) return 0;
    return this.isLittleEndian
      ? this.buf.readUInt32LE(offset)
      : this.buf.readUInt32BE(offset);
  }

  readRational(offset, tiffStart) {
    const num = this.readUint32(offset);
    const den = this.readUint32(offset + 4);
    if (den === 0) return 0;
    return num / den;
  }

  parseIfd(offset, tiffStart) {
    const tags = {};
    if (offset + 2 > this.buf.length) return tags;
    const count = this.readUint16(offset);
    let cur = offset + 2;

    for (let i = 0; i < count; i++) {
      if (cur + 12 > this.buf.length) break;
      const tag = this.readUint16(cur);
      const type = this.readUint16(cur + 2);
      const numValues = this.readUint32(cur + 4);
      const valOffset = cur + 8;

      let value = null;
      if (type === 2) {
        // ASCII string
        const dataOffset = numValues <= 4 ? valOffset : tiffStart + this.readUint32(valOffset);
        if (dataOffset + numValues <= this.buf.length) {
          value = this.buf.toString('ascii', dataOffset, dataOffset + numValues).replace(/\0+$/, '').trim();
        }
      } else if (type === 3) {
        // SHORT (uint16)
        value = this.readUint16(valOffset);
      } else if (type === 4) {
        // LONG (uint32)
        value = this.readUint32(valOffset);
      } else if (type === 5) {
        // RATIONAL (two uint32s: numerator, denominator)
        const ptr = tiffStart + this.readUint32(valOffset);
        if (numValues === 1) {
          value = this.readRational(ptr, tiffStart);
        } else if (numValues === 3) {
          // GPS DMS triple (degrees, minutes, seconds)
          value = [
            this.readRational(ptr, tiffStart),
            this.readRational(ptr + 8, tiffStart),
            this.readRational(ptr + 16, tiffStart),
          ];
        }
      }
      tags[tag] = value;
      cur += 12;
    }
    return tags;
  }
}

class ExifParserService {
  constructor() {
    this.PHOTO_STATUS = PHOTO_STATUS;
  }

  /**
   * Converts input (base64 Data URL, raw base64 string, or Buffer) to a Buffer.
   */
  toBuffer(input) {
    if (!input) return null;
    if (Buffer.isBuffer(input)) return input;
    if (typeof input === 'string') {
      if (input.startsWith('data:')) {
        const commaIndex = input.indexOf(',');
        if (commaIndex !== -1) {
          return Buffer.from(input.slice(commaIndex + 1), 'base64');
        }
      }
      return Buffer.from(input, 'base64');
    }
    return null;
  }

  /**
   * Inspects a photo and validates authenticity signals against reported GPS.
   * 
   * @param {Buffer|string} photoData - Base64 Data URL or Buffer of JPEG image
   * @param {Object} options - { reportedLatitude, reportedLongitude, maxDistanceMeters = 500 }
   * @returns {Object} Inspection result
   */
  inspectPhoto(photoData, options = {}) {
    const { reportedLatitude = null, reportedLongitude = null, maxDistanceMeters = 500 } = options;

    const buffer = this.toBuffer(photoData);
    if (!buffer || buffer.length < 4) {
      return {
        status: PHOTO_STATUS.INVALID_FILE,
        hasExif: false,
        gps: null,
        timestamp: null,
        distanceMeters: null,
        metadata: null,
        reason: 'Missing or corrupt image buffer',
      };
    }

    // Check JPEG SOI marker (0xFFD8)
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      // Non-JPEG format (e.g. WebP/PNG) - valid upload, but no JPEG EXIF
      return {
        status: PHOTO_STATUS.VALID_NO_METADATA,
        hasExif: false,
        gps: null,
        timestamp: null,
        distanceMeters: null,
        metadata: null,
        reason: 'Image is not a JPEG file',
      };
    }

    // Scan for APP1 (0xFFE1) marker
    let offset = 2;
    let app1Offset = -1;
    let app1Length = 0;

    while (offset < buffer.length - 4) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];

      // Stop scanning if SOS (Start of Scan) or EOI (End of Image) reached
      if (marker === 0xda || marker === 0xd9) break;

      const markerLength = buffer.readUInt16BE(offset + 2);

      if (marker === 0xe1) {
        // Check "Exif\0\0" header
        const exifHeader = buffer.toString('ascii', offset + 4, offset + 10);
        if (exifHeader === 'Exif\0\0') {
          app1Offset = offset + 10;
          app1Length = markerLength - 8;
          break;
        }
      }

      offset += 2 + markerLength;
    }

    if (app1Offset === -1) {
      // No Exif APP1 segment found: perfectly standard mobile/web upload
      return {
        status: PHOTO_STATUS.VALID_NO_METADATA,
        hasExif: false,
        gps: null,
        timestamp: null,
        distanceMeters: null,
        metadata: null,
        reason: 'No EXIF metadata segment in JPEG',
      };
    }

    try {
      const reader = new ExifReader(buffer);
      const tiffStart = app1Offset;

      // Read TIFF endianness
      const endianTag = buffer.toString('ascii', tiffStart, tiffStart + 2);
      if (endianTag === 'II') {
        reader.isLittleEndian = true;
      } else if (endianTag === 'MM') {
        reader.isLittleEndian = false;
      } else {
        return {
          status: PHOTO_STATUS.VALID_NO_METADATA,
          hasExif: false,
          gps: null,
          timestamp: null,
          distanceMeters: null,
          metadata: null,
          reason: 'Invalid TIFF endian tag',
        };
      }

      // Check 42 (0x002A)
      const magic = reader.readUint16(tiffStart + 2);
      if (magic !== 42) {
        return {
          status: PHOTO_STATUS.VALID_NO_METADATA,
          hasExif: false,
          gps: null,
          timestamp: null,
          distanceMeters: null,
          metadata: null,
          reason: 'Invalid TIFF magic number',
        };
      }

      // IFD0 offset from tiffStart
      const ifd0Offset = reader.readUint32(tiffStart + 4);
      const ifd0 = reader.parseIfd(tiffStart + ifd0Offset, tiffStart);

      let captureTimestamp = null;
      // Tag 0x8769: Exif SubIFD
      if (ifd0[0x8769]) {
        const exifSubIfd = reader.parseIfd(tiffStart + ifd0[0x8769], tiffStart);
        // Tag 0x9003: DateTimeOriginal
        if (exifSubIfd[0x9003]) {
          captureTimestamp = exifSubIfd[0x9003];
        }
      }

      let extractedGps = null;
      // Tag 0x8825: GPS SubIFD
      if (ifd0[0x8825]) {
        const gpsIfd = reader.parseIfd(tiffStart + ifd0[0x8825], tiffStart);
        const latDms = gpsIfd[0x0002]; // GPSLatitude
        const latRef = gpsIfd[0x0001]; // GPSLatitudeRef
        const lonDms = gpsIfd[0x0004]; // GPSLongitude
        const lonRef = gpsIfd[0x0003]; // GPSLongitudeRef

        if (Array.isArray(latDms) && Array.isArray(lonDms)) {
          let decLat = latDms[0] + latDms[1] / 60 + latDms[2] / 3600;
          if (latRef === 'S') decLat = -decLat;

          let decLon = lonDms[0] + lonDms[1] / 60 + lonDms[2] / 3600;
          if (lonRef === 'W') decLon = -decLon;

          extractedGps = {
            latitude: parseFloat(decLat.toFixed(7)),
            longitude: parseFloat(decLon.toFixed(7)),
          };
        }
      }

      // If no GPS tags found
      if (!extractedGps) {
        return {
          status: PHOTO_STATUS.VALID_NO_METADATA,
          hasExif: true,
          gps: null,
          timestamp: captureTimestamp,
          distanceMeters: null,
          metadata: {
            dateTimeOriginal: captureTimestamp,
          },
          reason: 'Photo has EXIF metadata but no GPS coordinates',
        };
      }

      // If citizen reported coordinates are available, compare distance
      let distanceMeters = null;
      let status = PHOTO_STATUS.VALID;
      let reason = null;

      if (
        reportedLatitude !== null &&
        reportedLatitude !== undefined &&
        reportedLongitude !== null &&
        reportedLongitude !== undefined
      ) {
        distanceMeters = calculateHaversineDistanceMeters(
          Number(reportedLatitude),
          Number(reportedLongitude),
          extractedGps.latitude,
          extractedGps.longitude
        );

        if (distanceMeters > maxDistanceMeters) {
          status = PHOTO_STATUS.LOCATION_MISMATCH;
          reason = `Photo EXIF GPS location (${extractedGps.latitude}, ${extractedGps.longitude}) is ${distanceMeters}m away from reported location (threshold: ${maxDistanceMeters}m).`;
        }
      }

      return {
        status,
        hasExif: true,
        gps: extractedGps,
        timestamp: captureTimestamp,
        distanceMeters,
        metadata: {
          dateTimeOriginal: captureTimestamp,
          exifGps: extractedGps,
          distanceMeters,
        },
        reason,
      };
    } catch (parseErr) {
      return {
        status: PHOTO_STATUS.VALID_NO_METADATA,
        hasExif: false,
        gps: null,
        timestamp: null,
        distanceMeters: null,
        metadata: null,
        reason: `EXIF parsing skipped: ${parseErr.message}`,
      };
    }
  }
}

const exifParserService = new ExifParserService();
module.exports = exifParserService;
