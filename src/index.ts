import { SQSEvent } from 'aws-lambda';
import { UPLOAD_BUCKET_NAME, URL_EXPIRE_TIME } from './constants';
import { S3ZipEvent } from './interfaces';
import { getSignedUrl, result, streamToZipInS3, validation } from './utils';

const handler = async (event: SQSEvent) => {
  const { valid, result: validationResult } = validation(event);
  if (!valid) return validationResult;

  const body: S3ZipEvent = JSON.parse(event.Records[0].body);
  const { files } = body;

  const zipFilePath = 'exports/' + Date.now().toString() + '.zip'
  console.log('Files to zip: ', files);
  console.log('Zip file path: ', zipFilePath);

  try {
    await streamToZipInS3(files, zipFilePath);
    const presignedUrl = await getSignedUrl(UPLOAD_BUCKET_NAME, zipFilePath, URL_EXPIRE_TIME, "export.zip");
    console.log("presignedUrl: ", presignedUrl);

    if (!presignedUrl) return result(500, 'Error making presigned url');

    return result(200, presignedUrl);

  } catch (error) {
    console.error(`Error: ${error}`);
    return result(500, 'Unhandled error');
  }
};

exports.handler = handler;

// To test in local, uncomment this
// handler({
//   Records: [
//     {
//       body: "{\"files\":[{\"name\":\"Maquette pédagogique.pdf\",\"path\":\"files/organization-1/Maquette pédagogique.pdf\"},{\"name\":\"Livrables S7 2021S SeÌ\u0081ance 7B.docx\",\"path\":\"files/organization-1/Livrables S7 2021S SeÌ\u0081ance 7B.docx\"}]}"
//     }
//   ]
// } as SQSEvent)

// CREATE TABLE IF NOT EXISTS export (
//   `id` VARCHAR(36) PRIMARY KEY NOT NULL DEFAULT (uuid()),
//   `token` VARCHAR(36) DEFAULT (uuid()),
//   `file_url` VARCHAR(500),
//   `user_id` VARCHAR(36) NOT NULL,
//   `status` ENUM('not_started', 'processing', 'ready', 'sent', 'error') NOT NULL DEFAULT 'not_started'
// );

// INSERT INTO export (`user_id`) VALUES ('userId');
