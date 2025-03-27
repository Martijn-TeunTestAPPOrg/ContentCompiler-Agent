import { Probot } from "probot";
import { simpleGit } from "simple-git";
import { preCompile } from "./compilers/preCompile.js";
//@ts-ignore
import { mainCompile } from "./compilers/mainCompile.js";
//@ts-ignore
import { isAppCommit } from "./helpers/globalHelpers.js";


// Initialize the git instance
const git = simpleGit().env({
	GIT_SSH_COMMAND: 'ssh -i /root/.ssh/id_rsa -o UserKnownHostsFile=/root/.ssh/known_hosts'
});

export default (app: Probot) => {	
	// Main compile
	//@ts-ignore
	app.on("push", async (context) => {
		// // Skip if this is a commit from our app
		// if (isAppCommit(context)) {
		// 	return;
		// }

		// // Only proceed if the target branch is 'content'
		// if (context.payload.ref === "refs/heads/content") {
		// 	await mainCompile(app, context, git);
		// }
		console.log("Main compile disabled");
	});

	// Pre compile
	app.on(["pull_request.opened", "pull_request.reopened", "pull_request.synchronize"], async (context) => {
		// Only proceed if the target branch is 'content'
		if (context.payload.pull_request.base.ref === "content") {
			await preCompile(app, context, git);
		}
	});	
};
