import { UPLOAD_BUCKET_NAME, URL_EXPIRE_TIME } from './constants';
import { S3ZipEvent } from './interfaces';
import { getSignedUrl, result, streamToZipInS3, validation } from './utils';

const handler = async (event: S3ZipEvent) => {
  const { files } = event;

  const { valid, result: validationResult } = validation(event);
  if (!valid) return validationResult;

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

// Uncomment to test, be careful to use the good File interface (need import)
// const testVars: File[] = [
//   {
//     name: 'Maquette pédagogique.pdf',
//     path: 'files/organization-1/Maquette pédagogique.pdf',
//   },
//   {
//     name: 'Accusé de réception.pdf',
//     path: 'files/organization-1/Accusé de réception.pdf',
//   },
// ];

// handler({ files: testVars});
