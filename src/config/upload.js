const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

const storageProvider = process.env.STORAGE_PROVIDER || 'cloudinary';

let storage;

if (storageProvider === 's3') {
  const s3Config = {
    region: process.env.AWS_REGION || 'ap-southeast-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  };

  if (process.env.AWS_ENDPOINT) {
    s3Config.endpoint = process.env.AWS_ENDPOINT;
    s3Config.forcePathStyle = true;
  }

  const s3 = new S3Client(s3Config);

  storage = multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, `daily_meat_catalog/${Date.now().toString()}-${file.originalname}`);
    }
  });
} else {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'daily_meat_catalog',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    },
  });
}

const upload = multer({ storage: storage });

/**
 * Public URL for an uploaded file. multer-s3's `location` is built from the S3 API endpoint, which
 * for Supabase Storage is not a browsable URL (404). Supabase serves public files from
 * /storage/v1/object/public/<bucket>/<key>.
 */
const getUploadedFileUrl = (file) => {
  if (!file) return null;
  if (file.path) return file.path; // Cloudinary
  if (storageProvider === 's3' && /supabase\.co/.test(process.env.AWS_ENDPOINT || '') && file.key) {
    const origin = new URL(process.env.AWS_ENDPOINT).origin;
    return `${origin}/storage/v1/object/public/${encodeURIComponent(file.bucket || process.env.AWS_S3_BUCKET_NAME)}/${file.key.split('/').map(encodeURIComponent).join('/')}`;
  }
  return file.location;
};

module.exports = {
  upload,
  getUploadedFileUrl,
  cloudinary: storageProvider === 'cloudinary' ? cloudinary : null,
};
