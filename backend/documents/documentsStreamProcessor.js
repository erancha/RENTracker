const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const cloudfront = new CloudFrontClient();
const s3 = new S3Client();

exports.handler = async (event) => {
  // console.log('Received event:', JSON.stringify(event, null, 2));

  const CLOUDFRONT_DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID;
  const FRONTEND_BUCKET_NAME = process.env.FRONTEND_BUCKET_NAME;
  const SAAS_TENANT_ID = process.env.SAAS_TENANT_ID;

  console.log({ CLOUDFRONT_DISTRIBUTION_ID, FRONTEND_BUCKET_NAME });

  try {
    for (const record of event.Records) {
      if (record.eventName === 'MODIFY' || record.eventName === 'REMOVE') {
        const documentId = record.dynamodb.Keys.document_id.S;
        const s3ObjectKey = `documents/${SAAS_TENANT_ID}/${documentId}-rental-agreement.pdf`;

        // Invalidate the CloudFront cache for the specific object:
        const command = new CreateInvalidationCommand({
          DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
          InvalidationBatch: {
            CallerReference: `${Date.now()}`,
            Paths: {
              Quantity: 1,
              Items: [`/${s3ObjectKey}`],
            },
          },
        });
        await cloudfront.send(command);
        console.log(`Invalidation request sent for: ${s3ObjectKey}`);

        // Delete the object from S3:
        const deleteCommand = new DeleteObjectCommand({
          Bucket: FRONTEND_BUCKET_NAME,
          Key: s3ObjectKey,
        });
        await s3.send(deleteCommand);
        console.log(`Deleted S3 object: ${s3ObjectKey}`);

        // Regenerate the PDF and upload it to S3:
        // TODO
      }
    }
  } catch (error) {
    console.error('Error processing stream event:', error);
    throw error;
  }
};
