import path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { Probot, Context } from "probot";
import { SimpleGit } from "simple-git";

// Helper function to check if the commit is from our app
export function isAppCommit(context: Context<'push'>) {
    const sender = context.payload.sender;
    const commits = context.payload.commits || [];
    
    // Check both the sender and the commit message
    return (sender && sender.type === 'Bot' && sender.login.endsWith('[bot]')) ||
           commits.some(commit => commit.message.includes('[bot-commit]'));
}

// Helper function to configure git
export async function configureGit(git: SimpleGit, gitAppName: string, gitAppEmail: string) {
    if (!gitAppName || !gitAppEmail) {
        throw new Error('Git app name or email not configured in environment variables');
    }
    // Set user info explicitly
    await git.addConfig("user.name", gitAppName, false, 'local');
    await git.addConfig("user.email", gitAppEmail, false, 'local');

    // Set committer info explicitly
    await git.addConfig("committer.name", gitAppName, false, 'local');
    await git.addConfig("committer.email", gitAppEmail, false, 'local');
}

// Helper function to get default configuration values
export function getPayloadInfo(context: Context<any>) {
    const payload = context.payload;
    const repoOwner = payload.repository.owner.login;
    const repoName = payload.repository.name;

    return { repoOwner, repoName };
}

// Helper function to clear temp storage
export function clearTempStorage(app: Probot, contentRootDir: string, tempStorageDir: string, datasetDir: string) {
    try {
        app.log.info('Clearing temp folders...');

        // Remove the content_repo folder if it exists
        if (fs.existsSync(contentRootDir)) {
            deleteFolderRecursive(app, contentRootDir);
        }
        fs.mkdirSync(contentRootDir, { recursive: true });
        app.log.info(`Created ${contentRootDir}`);

        // Remove the content_repo folder if it exists
        if (fs.existsSync(tempStorageDir)) {
            deleteFolderRecursive(app, tempStorageDir);
        }
        fs.mkdirSync(tempStorageDir, { recursive: true });
        app.log.info(`Created ${tempStorageDir}`);

        // Remove the dataset folder if it exists
        if (fs.existsSync(datasetDir)) {
            deleteFolderRecursive(app, datasetDir);
        }
        fs.mkdirSync(datasetDir, { recursive: true });
        app.log.info(`Created ${datasetDir}`);
    } catch (error: any) {
        app.log.error(`Failed to remove temp folders: ${error.message}`);
        throw error;
    }
}

// Helper function to delete a folder recursively
export function deleteFolderRecursive(app: Probot, folderPath: string) {
    if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);

        files.forEach((file) => {
            const currentPath = path.join(folderPath, file);

            if (fs.statSync(currentPath).isDirectory()) {
                deleteFolderRecursive(app,currentPath);
            } else {
                fs.unlinkSync(currentPath);
            }
        });

        fs.rmdirSync(folderPath);
    } else {
        app.log.warn(`Folder ${folderPath} does not exist`);
    }
}

// Helper function to clone a repo
export async function cloneRepo(app: Probot, git: SimpleGit, repo: string, targetDirectory: string) {
    try {
        // Remove the target directory if it exists
        deleteFolderRecursive(app, targetDirectory);

        // Clones the repo to a specific folder
        await git.clone(repo, targetDirectory);
        app.log.info(`Repo cloned successfully to ${targetDirectory}`);
    } catch (error: any) {
        app.log.error(`Failed to clone repo ${repo}: ${error.message}`);
        throw error;
    }
}

// Helper function to checkout a branch
export async function checkoutBranch(app: Probot, git: SimpleGit, branch: string) {
    try {
        await git.checkout(branch);
        await git.pull('origin', branch);
        app.log.info(`Checked out and pulled branch ${branch}`);
    } catch (error: any) {
        app.log.error(`Failed to checkout or pull branch ${branch}: ${error.message}`);
        throw error;
    }
}

// Run the python parser
export async function compileContent(app: Probot, compileCommand: string) {    
    await new Promise<void>((resolve, reject) => {
        app.log.info(`Content compilation process started...`);
        const pythonProcess = exec(compileCommand);
        
        let stdoutData = '';
        let stderrData = '';

        // Collect stdout data
        pythonProcess.stdout?.on('data', (data: any) => {
            stdoutData += data;
        });

        // Collect stderr data
        pythonProcess.stderr?.on('data', (data: any) => {
            stderrData += data;
        });

        // Handle process completion
        pythonProcess.on('close', (code: any) => {
            if (code === 0) {
                app.log.info('Python script output:');

                if(stdoutData) {
                    app.log.info(stdoutData);
                }
                if(stderrData) {
                    app.log.info(stderrData);
                }

                app.log.info(`Content compilation process completed`);
                resolve();
            } else {
                app.log.error(`Python script failed with code ${code}`);
                app.log.error(`Error output: ${stderrData}`);
                reject(new Error(`Python script failed with code ${code}`));
            }
        });
    });
}

// Helper function to copy specific files from one directory to another
export async function copySpecificFiles(app: Probot, files: string[], srcDir: string, destDir: string) {
    try {
        app.log.info(`Copying files from ${srcDir} to ${destDir}...`);

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

            app.log.info(`Copied ${file} to ${destinationPath}`);
        }
    } catch (error: any) {
        app.log.error(`Failed to copy files: ${error.message}`);
        throw error;
    }
}

// Helper function to copy a folder recursively
export async function copyFolder(app: Probot, srcDir: string, destDir: string) {
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
                copyFolder(app, sourcePath, destinationPath);
            } else {
                fs.copyFileSync(sourcePath, destinationPath);
            }
        });
    } catch (error: any) {
        app.log.error(`Failed to copy folder: ${error.message}`);
        throw error;
    }
}

// Helper function to commit and push changes
export async function updateRemote(app: Probot, git: SimpleGit, branch: string, items: string[], message: string) {
    try {
        app.log.info(`Committing and pushing changes to the ${branch} branch...`);

        // Ensure the remote URL is set correctly to SSH
        const remotes = await git.getRemotes(true);
        const originRemote = remotes.find(remote => remote.name === 'origin');

        if (!originRemote || !originRemote.refs.fetch.startsWith('git@github.com:')) {
            throw new Error(`Origin remote is missing or not using SSH. Found: ${originRemote?.refs.fetch}`);
        }

        await git.add(items);
        const status = await git.status();

        if (!status.isClean()) {
            await git.commit(message, undefined, {
                '--no-verify': null
            });
            await git.push('origin', branch);
            app.log.info('Changes committed and pushed successfully');
        } else {
            app.log.error(`No changes to commit to the ${branch} branch`);
        }
    } catch (error: any) {
        app.log.error(`Failed to commit and push changes: ${error.message}`);
        throw error;
    }
}

// Helper function to delete the build folder
export async function deleteBuildFolder(app: Probot, git: SimpleGit, contentBuildDir: string) {
    try {
        const resolvedContentBuildDir = path.resolve(contentBuildDir);
        app.log.info(`Removing the build directory from the staging branch: ${resolvedContentBuildDir}`);

        if (fs.existsSync(resolvedContentBuildDir)) {
            await git.rm(['-r', resolvedContentBuildDir]);
            deleteFolderRecursive(app, resolvedContentBuildDir);
            app.log.info(`Build directory ${resolvedContentBuildDir} removed successfully`);
        } else {
            app.log.warn(`Build directory ${resolvedContentBuildDir} does not exist!`);
        }
    } catch (error: any) {
        app.log.error(`Failed to remove the build directory from the staging branch: ${error.message}`);
        throw error;
    }
}

// Helper function to delete the reports
export async function deleteReports(app: Probot, git: SimpleGit, fileDir: string, reportFiles: string[]) {
    try {
        app.log.info('Removing the reports from the staging branch...');

        for (const file of reportFiles) {
            // Get the resolved file path since the reportFiles array contains only the file names
            const resolvedFilePath = path.resolve(fileDir, file);
            if (fs.existsSync(resolvedFilePath)) {
                // Remove the file from the git staging area, this doesn't use the resolved path, since these are in the git staging area
                await git.rm(file);
                app.log.info(`Report ${resolvedFilePath} removed successfully`);
            } else {
                app.log.error(`Report ${resolvedFilePath} does not exist!`);
            }
        }
    } catch (error: any) {
        app.log.error(`Failed to remove the reports from the staging branch: ${error.message}`);
        throw error;
    }
}

// Helper function to see which files are changed in the PR
export async function getChangedFiles(app: Probot, git: SimpleGit, contentRootDir: string, baseBranch: string, headBranch: string) {
    try {
        app.log.info(`Getting changed files between ${baseBranch} and ${headBranch}...`);

        // Fetch both branches to ensure we have the latest
        await git.cwd(contentRootDir).fetch(['origin', baseBranch]);
        await git.cwd(contentRootDir).fetch(['origin', headBranch]);
        
        // Get the diff between base and head
        const diff = await git.cwd(contentRootDir)
            .diff([`origin/${baseBranch}...origin/${headBranch}`, '--name-status']);
        
        // Parse the diff output into a more useful format
        return diff.split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => {
                const [status, oldFilename, filename] = line.split('\t');
                
                // Handle renamed files (they have old and new names)
                if (status === 'R' || status.startsWith('R')) {
                    return {
                        filename,  // new name
                        oldFilename,  // old name
                        status: 'renamed'
                    };
                }

                // Handle added, modified, deleted, copied, unmerged, type_changed
                return {
                    filename: oldFilename,
                    status: status === 'A' ? 'added' :           // Added
                           status === 'M' ? 'modified' :         // Modified
                           status === 'D' ? 'deleted' :          // Deleted
                           status === 'C' ? 'copied' :           // Copied
                           status === 'U' ? 'unmerged' :         // Unmerged (conflict)
                           status === 'T' ? 'type_changed' :     // File type changed
                           status
                };
            });
    } catch (error) {
        app.log.error(`Error getting PR changed files: ${error}`);
        throw error;
    }
}

// Helper function to see if the PR has illegal changes
export async function checkIllegalChanges(app: Probot, prNumber: number, changedFiles: { filename: string, status: string }[]) {
    app.log.info(`Checking for illegal changes in PR ${prNumber}...`);

    const illegalChangedFiles = changedFiles
        .filter(file => !file.filename.startsWith('content/'))
        .map(file => `${file.filename} (${file.status})`);

    if (illegalChangedFiles.length > 0) {
        app.log.warn(`Illegal changed files: `);
        app.log.warn(illegalChangedFiles);
    }

    return illegalChangedFiles;
}

// Helper function to post a comment on the PR
export async function postPRReview(app: Probot, context: Context<'pull_request'>, repoOwner: string, repoName: string, prNumber: number, prEvent: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', commentBody: string) {
    try {
        app.log.info(`Posting comment on PR ${prNumber}...`);

        // Create a review requesting changes
        const review = await context.octokit.pulls.createReview({
            owner: repoOwner,
            repo: repoName,
            pull_number: prNumber,
            event: prEvent,
            body: commentBody
        });

        // Log the review ID
        app.log.info(`Successfully posted comment with ID ${review.data.id}`);

        return review.data.id;
    } catch (error: any) {
        app.log.error(`Error posting comment: ${error}`);

        // Log the specific error details
        if (error instanceof Error) {
            app.log.error(`Error message: ${error.message}`);
            app.log.error(`Error stack: ${error.stack}`);
        }

        return undefined;
    }
}

// Helper function to hide previous bot comments
// A problem with this code is that when it hides a comment via graphql, it marks them with the classifier OUTDATED
// There's no way to do this via the Github API, so we have to use GraphQL`
// The problem with this is that the classifier is not visible in the API, so we can't check if a comment is already hidden
// This means that the code will hide all bot comments, even if they are already hidden
// To *solve* this problem, the code skips hiding the latest comments since these have already been hidden in a previous run
// This is done via the let count which is incremented for each hidden comment
// The code will only hide the first 10 comments, which is a workaround to prevent hiding all comments
// The comments are sorted by creation time in ascending order
// 10 is an arbitrary number, but it should be enough to prevent hiding all comments
// The real solution would be to use the API to check if a comment is already hidden, but this is not possible
// This is a workaround, not a solution
export async function hideBotComments(app: Probot, context: Context<'pull_request'>, repoOwner: string, repoName: string, prNumber: number, stepNineReviewId: number | undefined) {
    try {
        app.log.info('Fetching all reviews on the PR...');
		const reviews = await context.octokit.paginate(
			context.octokit.pulls.listReviews,
			{
			owner: repoOwner,
			repo: repoName,
			pull_number: prNumber,
			per_page: 100,              // Fetch up to 100 reviews per page
			}
		);

		// Sort reviews by submitted_at in desc order
		reviews.sort((a, b) => new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime());

        app.log.info(`Fetched ${reviews.length} reviews on the PR`);

        // Filter out bot comments
        const botReviews = reviews.filter(review =>
            review.user?.login === process.env.GITHUB_BOT_NAME && 
            review.user?.type === "Bot"
        );

        app.log.info(`Found ${botReviews.length} previous bot comments.`);

        // Hide all bot comments except the most recent one if it was posted in this run
        let count = 0;
        for (const review of botReviews) {
            if (count >= 8) {
                app.log.info(`Hid 10 bot comments, stopping...`);
                break;
            }

            // Skip hiding the most recent comment if it was posted in this run
            if (stepNineReviewId !== undefined && review.id === stepNineReviewId) {
                app.log.info(`Skipping hiding most recent comment with ID ${review.id} since it was posted in this run`);
                continue;
            }

            // Use GraphQL to minimize the review
            const query = `
                mutation MinimizeComment($id: ID!) {
                    minimizeComment(input: { subjectId: $id, classifier: OUTDATED }) {
                        clientMutationId
                    }
                }
            `;

            await context.octokit.graphql(query, {
                id: review.node_id,
            });

            app.log.info(`Minimized review with ID ${review.id}`);
            count++;
        }
    } catch (error: any) {
        app.log.error(`Error hiding previous bot comments: ${error}`);

        // Log the specific error details
        if (error instanceof Error) {
            app.log.error(`Error message: ${error.message}`);
            app.log.error(`Error stack: ${error.stack}`);
        }
    }
}