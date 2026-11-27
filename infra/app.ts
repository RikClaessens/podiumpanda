import { App } from "aws-cdk-lib";
import { DomainCertificateStack } from "./domain.ts";
import { PodiumPandaStack } from "./stack.ts";

const app = new App();
const stage: unknown = app.node.tryGetContext("stage");
if (stage !== "dev" && stage !== "prod") throw new Error("stage must be dev or prod.");
const account = process.env.CDK_DEFAULT_ACCOUNT;
const domain =
  stage === "prod"
    ? new DomainCertificateStack(app, "PodiumPanda-Certificate", {
        env: { account, region: "us-east-1" },
        crossRegionReferences: true,
      })
    : undefined;
new PodiumPandaStack(app, `PodiumPanda-${stage}`, {
  stage,
  env: { account, region: "eu-west-1" },
  crossRegionReferences: stage === "prod",
  domain: domain && { hostedZoneId: domain.hostedZoneId, certificate: domain.certificate },
});
