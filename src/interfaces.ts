export interface S3ZipEvent {
  files: File[];
};

export interface File {
  name: string;
  path: string;
}

export interface Result {
  statusCode: number;
  body: string;
}