const crypto = require('crypto');
const https = require('https');
const { promisify } = require('util');

class S3Service {
  constructor() {
    this.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    this.region = process.env.AWS_REGION || 'eu-north-1';
    this.bucket = process.env.AWS_S3_BUCKET_NAME;
    this.host = `${this.bucket}.s3.${this.region}.amazonaws.com`;
  }

  // Generate AWS Signature V4
  generateSignature(method, path, headers, payload) {
    const date = new Date();
    const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '');
    const amzDate = date.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';

    // Create canonical request
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key]}`)
      .join('\n') + '\n';

    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');

    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

    const canonicalRequest = [
      method,
      path,
      '', // query string
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    // Calculate signature
    const signingKey = this.getSignatureKey(this.secretAccessKey, dateStamp, this.region, 's3');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    return {
      signature,
      amzDate,
      credentialScope,
      signedHeaders
    };
  }

  getSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    return kSigning;
  }

  // Upload file to S3 using direct HTTP request
  async uploadFile(fileBuffer, fileName, contentType, folder = 'uploads') {
    return new Promise((resolve, reject) => {
      const key = `${folder}/${Date.now()}-${fileName}`;
      const path = `/${key}`;

      const headers = {
        'Host': this.host,
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length,
        'x-amz-content-sha256': crypto.createHash('sha256').update(fileBuffer).digest('hex')
      };

      const { signature, amzDate, credentialScope, signedHeaders } = this.generateSignature('PUT', path, headers, fileBuffer);

      headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
      headers['x-amz-date'] = amzDate;

      const options = {
        hostname: this.host,
        port: 443,
        path: path,
        method: 'PUT',
        headers: headers
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            const fileUrl = `https://${this.host}${path}`;
            resolve({
              success: true,
              url: fileUrl,
              key: key,
              bucket: this.bucket
            });
          } else {
            reject(new Error(`Upload failed with status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(fileBuffer);
      req.end();
    });
  }

  // Delete file from S3
  async deleteFile(key) {
    return new Promise((resolve, reject) => {
      const path = `/${key}`;

      const headers = {
        'Host': this.host,
        'x-amz-content-sha256': crypto.createHash('sha256').update('').digest('hex')
      };

      const { signature, amzDate, credentialScope, signedHeaders } = this.generateSignature('DELETE', path, headers, '');

      headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
      headers['x-amz-date'] = amzDate;

      const options = {
        hostname: this.host,
        port: 443,
        path: path,
        method: 'DELETE',
        headers: headers
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 204) {
            resolve({ success: true });
          } else {
            reject(new Error(`Delete failed with status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  // Generate folder path based on file type
  getFolderPath(fileType, userId) {
    const basePaths = {
      profilePhoto: `profiles/${userId}`,
      idPhotoFront: `verification/id-documents/${userId}`,
      idPhotoBack: `verification/id-documents/${userId}`,
      certificates: `verification/certificates/${userId}`,
      portfolioImages: `verification/portfolio/${userId}`,
      verificationDocuments: `verification/documents/${userId}`
    };

    return basePaths[fileType] || `uploads/${userId}`;
  }
}

module.exports = new S3Service();
