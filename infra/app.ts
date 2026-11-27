import { App } from "aws-cdk-lib";
import { PodiumPandaStack } from "./stack.ts";

const app = new App();
const stage: unknown = app.node.tryGetContext("stage");
if (stage !== "dev" && stage !== "prod") throw new Error("stage must be dev or prod.");
new PodiumPandaStack(app, `PodiumPanda-${stage}`, {
  stage,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-1" },
});
