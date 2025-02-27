import path from "path";
import * as fs from "fs";
import winston from "winston";
import { Probot } from "probot";
import { SimpleGit } from "simple-git";


// Helper function to delete a folder recursively
export function deleteFolderRecursive(app: Probot, logger: winston.Logger, folderPath: string) {
    if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);

        files.forEach((file) => {
            const currentPath = path.join(folderPath, file);

            if (fs.statSync(currentPath).isDirectory()) {
                deleteFolderRecursive(app, logger, currentPath);
            } else {
                fs.unlinkSync(currentPath);
            }
        });

        fs.rmdirSync(folderPath);
    } else {
        logger.warn(`Folder ${folderPath} does not exist`);
    }
}

// Helper function to clear temp storage
export function clearTempStorage(app: Probot, logger: winston.Logger, contentRootDir: string, tempStorageDir: string, datasetDir: string) {
    try {
        logger.info('Clearing temp folders...');

        // Remove the content_repo folder if it exists
        if (fs.existsSync(contentRootDir)) {
            deleteFolderRecursive(app, logger, contentRootDir);
        }
        fs.mkdirSync(contentRootDir, { recursive: true });
        logger.info(`Created ${contentRootDir}`);

        // Remove the content_repo folder if it exists
        if (fs.existsSync(tempStorageDir)) {
            deleteFolderRecursive(app, logger, tempStorageDir);
        }
        fs.mkdirSync(tempStorageDir, { recursive: true });
        logger.info(`Created ${tempStorageDir}`);

        // Remove the dataset folder if it exists
        if (fs.existsSync(datasetDir)) {
            deleteFolderRecursive(app, logger, datasetDir);
        }
        fs.mkdirSync(datasetDir, { recursive: true });
        logger.info(`Created ${datasetDir}`);
    } catch (error: any) {
        logger.error(`Failed to remove temp folders: ${error.message}`);
        throw error;
    }
}

// Helper function to copy specific files from one directory to another
export async function copySpecificFiles(logger: winston.Logger, files: string[], srcDir: string, destDir: string) {
    try {
        logger.info(`Copying files from ${srcDir} to ${destDir}...`);

        // Ensure destination directory exists
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        for (const file of files) {
            const sourcePath = path.join(srcDir, file);
            const destinationPath = path.join(destDir, file);

            // Ensure the destination directory for the file exists
            const destinationDir = path.dirname(destinationPath);
            if (!fs.existsSync(destinationDir)) {
                fs.mkdirSync(destinationDir, { recursive: true });
            }

            fs.copyFileSync(sourcePath, destinationPath);

            logger.info(`Copied ${file} to ${destinationPath}`);
        }
    } catch (error: any) {
        logger.error(`Failed to copy files: ${error.message}`);
        throw error;
    }
}

// Helper function to copy a folder recursively
export async function copyFolder(logger: winston.Logger, srcDir: string, destDir: string) {
    try {
        // Ensure destination directory exists
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        // Copy files and directories recursively
        fs.readdirSync(srcDir).forEach((file) => {
            const sourcePath = path.join(srcDir, file);
            const destinationPath = path.join(destDir, file);

            if (fs.lstatSync(sourcePath).isDirectory()) {
                copyFolder(logger, sourcePath, destinationPath);
            } else {
                fs.copyFileSync(sourcePath, destinationPath);
            }
        });
    } catch (error: any) {
        logger.error(`Failed to copy folder: ${error.message}`);
        throw error;
    }
}

// Helper function to delete the build folder
export async function deleteBuildFolder(app: Probot, logger: winston.Logger, git: SimpleGit, contentBuildDir: string) {
    try {
        const resolvedContentBuildDir = path.resolve(contentBuildDir);
        logger.info(`Removing the build directory from the staging branch: ${resolvedContentBuildDir}`);

        if (fs.existsSync(resolvedContentBuildDir)) {
            await git.rm(['-r', resolvedContentBuildDir]);
            deleteFolderRecursive(app, logger, resolvedContentBuildDir);
            logger.info(`Build directory ${resolvedContentBuildDir} removed successfully`);
        } else {
            logger.warn(`Build directory ${resolvedContentBuildDir} does not exist!`);
        }
    } catch (error: any) {
        logger.error(`Failed to remove the build directory from the staging branch: ${error.message}`);
        throw error;
    }
}

// Helper function to delete the reports
export async function deleteReports(logger: winston.Logger, git: SimpleGit, fileDir: string, reportFiles: string[]) {
    try {
        logger.info('Removing the reports from the staging branch...');

        for (const file of reportFiles) {
            // Get the resolved file path since the reportFiles array contains only the file names
            const resolvedFilePath = path.resolve(fileDir, file);
            if (fs.existsSync(resolvedFilePath)) {
                // Remove the file from the git staging area, this doesn't use the resolved path, since these are in the git staging area
                await git.rm(file);
                logger.info(`Report ${resolvedFilePath} removed successfully`);
            } else {
                logger.error(`Report ${resolvedFilePath} does not exist!`);
            }
        }
    } catch (error: any) {
        logger.error(`Failed to remove the reports from the staging branch: ${error.message}`);
        throw error;
    }
}
