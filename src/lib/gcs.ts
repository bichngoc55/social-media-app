import { Storage, GetSignedUrlConfig } from "@google-cloud/storage";
import path from "path";

const storage = new Storage({
  keyFilename: process.env.GCS_CREDENTIALS,
  projectId: process.env.GCS_PROJECT_ID,
});

const bucketName = process.env.GCS_BUCKET!;
const bucket = storage.bucket(bucketName);

export async function generateUploadSignedUrl(
  filePath: string,
  contentType: string,
  expiresInMinutes = 15,
  maxSizeInBytes = 10000000
): Promise<string> {
  const options: GetSignedUrlConfig = {
    version: "v4",
    action: "write",
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  };

  const [url] = await bucket.file(filePath).getSignedUrl(options);
  return url;
}

export async function generateDownloadSignedUrl(
  filePath: string,
  expiresInMinutes = 30
): Promise<string> {
  const options: GetSignedUrlConfig = {
    version: "v4",
    action: "read",
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  };

  const [url] = await bucket.file(filePath).getSignedUrl(options);
  return url;
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await bucket.file(filePath).delete();
  } catch (error) {
    console.error("Error deleting file from GCS:", error);
    throw error;
  }
}

export function getPublicUrl(filePath: string): string {
  return `https://storage.googleapis.com/${bucketName}/${filePath}`;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const [exists] = await bucket.file(filePath).exists();
    return exists;
  } catch (error) {
    console.error("Error checking file existence:", error);
    return false;
  }
}

export async function makeFilePublic(filePath: string): Promise<void> {
  try {
    await bucket.file(filePath).makePublic();
  } catch (error) {
    console.error("Error making file public:", error);
    throw error;
  }
}
