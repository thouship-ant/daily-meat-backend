require('dotenv').config();
const { S3Client, PutObjectCommand, GetObjectCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');

async function testS3Connection() {
  console.log('========================================');
  console.log('   DAILY MEAT - S3 STORAGE TEST        ');
  console.log('========================================');
  console.log('Provider:          ', process.env.STORAGE_PROVIDER || 's3');
  console.log('Region:            ', process.env.AWS_REGION || 'ap-southeast-1');
  console.log('Endpoint:          ', process.env.AWS_ENDPOINT || '(default AWS S3)');
  console.log('Bucket:            ', process.env.AWS_S3_BUCKET_NAME);
  console.log('Access Key ID:     ', process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 6)}...` : 'MISSING');
  console.log('Secret Key:        ', process.env.AWS_SECRET_ACCESS_KEY ? '******' : 'MISSING');
  console.log('----------------------------------------');

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET_NAME) {
    console.error('❌ Missing required S3 environment variables in .env');
    process.exit(1);
  }

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
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  const testKey = `health-check/test-${Date.now()}.txt`;
  const testPayload = `Daily Meat S3 health check timestamp: ${new Date().toISOString()}`;

  try {
    console.log(`1. Uploading test file "${testKey}"...`);
    const putRes = await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: testPayload,
      ContentType: 'text/plain'
    }));
    console.log('   ✅ Upload success! ETag:', putRes.ETag);

    console.log(`2. Reading test file "${testKey}" back...`);
    const getRes = await s3.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: testKey
    }));
    const text = await getRes.Body.transformToString();
    console.log('   ✅ Download success! File content:', text);

    console.log('\n🎉 S3 Storage configuration is working perfectly!');
  } catch (error) {
    console.error('\n❌ S3 test failed:', error.message);
    if (error.$metadata) {
      console.error('HTTP Status:', error.$metadata.httpStatusCode);
    }
    process.exit(1);
  }
}

testS3Connection();
