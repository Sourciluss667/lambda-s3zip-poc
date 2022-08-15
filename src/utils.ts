import AWS from 'aws-sdk';
import archiver from 'archiver';
import stream from 'stream';

import { UPLOAD_BUCKET_NAME } from "./constants";
import { S3ZipEvent, Result, File } from "./interfaces";

// Uncomment this when you launch in local
// AWS.config.update({
//   region: 'eu-west-3',
//   credentials: new AWS.Credentials('AKIARVHUEGZ57TKQIV6R', 'UdkAhb/cQFV/e8ymX0OrA1dWfJAIFPuxySk0ez18'),
// });

const S3 = new AWS.S3({
apiVersion: '2006-03-01',
signatureVersion: 'v4',
httpOptions: {
  timeout: 300000
}
});

export const result = (code: number, message: string): Result => {
  return {
    statusCode: code,
    body: JSON.stringify(
      {
        message: message
      }
    )
  }
}

export const validation = (event: S3ZipEvent): {
  valid: boolean;
  result?: Result;
} => {
  const { files } = event;

  if (files.length == 0) {
    console.log('No files to zip');
    return {
      valid: false,
      result: result(404, 'No files to download'),
    };
  }

  return {
    valid: true,
  }
};

export const streamToZipInS3 = async (files: File[], zipFilePath: string) => {
  await new Promise(async (resolve, reject) => {
    const zipStream = streamTo(UPLOAD_BUCKET_NAME, zipFilePath, resolve);
    zipStream.on('error', reject);

    const archive = archiver('zip');
    archive.on("error", error => {
      console.error(error);
      throw new Error(error.message);
    });
    archive.pipe(zipStream);

    for (const file of files) {
      archive.append(getStream(UPLOAD_BUCKET_NAME, file.path), {
        name: file.name
      });
    }
    archive.finalize();
  })
  .catch(err => {
    console.log(err);
    throw new Error(err);
  });
}

const streamTo = (bucket: string, key: string, resolve: (value: unknown) => void) => {
  const passthrough = new stream.PassThrough();
  S3.upload(
    {
      Bucket: bucket,
      Key: key,
      Body: passthrough,
      ContentType: "application/zip",
      ServerSideEncryption: "AES256"
    },
    (error, data) => {
      if (error) {
        console.error('Error while uploading zip')
        throw new Error(error.message);
      }
      console.log('Zip uploaded')
      resolve(data);
    }
  ).on("httpUploadProgress", progress => {
    console.log(progress)
  });
  return passthrough;
}

const getStream = (bucket: string, key: string) => {
  let streamCreated = false;
  const passThroughStream = new stream.PassThrough();

  passThroughStream.on("newListener", event => {
    if (!streamCreated && event == "data") {
      const s3Stream = S3
        .getObject({ Bucket: bucket, Key: key })
        .createReadStream();
      s3Stream
        .on("error", err => passThroughStream.emit("error", err))
        .pipe(passThroughStream);

      streamCreated = true;
    }
  });

  return passThroughStream;
}

export const getSignedUrl = async (bucket: string, key: string, expires: number, downloadFilename: string) => {
  const exists = await objectExists(bucket, key);
  if (!exists) {
      console.info(`Object ${bucket}/${key} does not exists`);
      return null
  }

  let params: {
    Bucket: string;
    Key: string;
    Expires: number;
    ResponseContentDisposition?: string;
  } = {
      Bucket: bucket,
      Key: key,
      Expires: expires,
  };

  if (downloadFilename) {
      params.ResponseContentDisposition = `inline; filename="${encodeURIComponent(downloadFilename)}"`; 
  }
  
  try {
      const url = S3.getSignedUrl('getObject', params);
      return url;
  } catch (err) {
      console.error(`Unable to get URL for ${bucket}/${key}`, err);
      return null;
  }
};

const objectExists = async (bucket: string, key: string): Promise<boolean> => {
  return S3
  .headObject({
    Bucket: bucket,
    Key: key,
  })
  .promise()
  .then(
    () => true,
    err => {
      if (err.code === 'NotFound') {
        return false;
      }
      throw err;
    }
  );
}
