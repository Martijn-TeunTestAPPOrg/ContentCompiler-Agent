import fs from "fs";
import winston from "winston";
import { handleError } from "./globalHelpers.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";


// Cloudflare R2 Config
const s3Client = new S3Client({
    endpoint: process.env.CLOUDFLARE_R2_BUCKET_URL,
    region: process.env.CLOUDFLARE_R2_REGION,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? "",
    },
});

// Upload logs to R2
export async function uploadLogToR2(logger: winston.Logger, logFilePath: string) {
    try {
        const logContent = fs.readFileSync(logFilePath);
        const fileName = logFilePath.split("/").pop();

        const params = {
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME ?? "",
            Key: `logs/${fileName}`,
            Body: logContent,
            ContentType: "text/plain",
        };

        await s3Client.send(new PutObjectCommand(params));
        logger.info(`Uploaded log ${logFilePath} to R2`);
    } catch (error) {
        handleError(logger, `Error uploading log ${logFilePath} to R2`, error);
    }
}
