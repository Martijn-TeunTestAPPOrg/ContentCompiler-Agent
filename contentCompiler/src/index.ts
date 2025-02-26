import { pino } from "pino";
import { Probot } from "probot";
import { simpleGit } from "simple-git";
import { preCompile } from "./preCompile.js";
import { mainCompile } from "./mainCompile.js";
import { isAppCommit, configureGit } from "./helpers.js";

const git = simpleGit().env({
	GIT_SSH_COMMAND: 'ssh -i /root/.ssh/id_rsa -o UserKnownHostsFile=/root/.ssh/known_hosts'
});

export default (app: Probot) => {	
	// Override Probot's default logger to remove `req`
	app.log = pino({
		level: "info",
		serializers: {
			req: () => undefined, // Removes `req` from logs
			res: pino.stdSerializers.res,
			err: pino.stdSerializers.err
		}
	});

	// Main compile
	app.on("push", async (context) => {
		// Skip if this is a commit from our app
		if (isAppCommit(context)) {
			return;
		}

		// Only proceed if the target branch is 'content'
		if (context.payload.ref === "refs/heads/" + process.env.CONTENT_BRANCH) {
			await mainCompile(app, context, git);
		}
	});

	// Pre compile
	app.on(["pull_request.opened", "pull_request.reopened", "pull_request.synchronize"], async (context) => {
		// Only proceed if the target branch is 'content'
		if (context.payload.pull_request.base.ref === process.env.CONTENT_BRANCH) {
			await preCompile(app, context, git);
		}
	});	
};
