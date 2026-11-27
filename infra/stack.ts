import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Stack, CfnOutput, Duration, RemovalPolicy, type StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as apigateway from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as deployment from "aws-cdk-lib/aws-s3-deployment";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import { productionDomain } from "./domain.ts";

export class PodiumPandaStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: StackProps & {
      stage: "dev" | "prod";
      domain?: { hostedZoneId: string; certificate: acm.ICertificate };
    },
  ) {
    super(scope, id, props);
    if ((props.stage === "prod") !== !!props.domain) {
      throw new Error("The production stage requires a domain; development must not use it.");
    }
    const table = new dynamodb.Table(this, "Concerts", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const bucket = new s3.Bucket(this, "Frontend", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const backend = new NodejsFunction(this, "Backend", {
      entry: resolve("backend/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(20),
      environment: { TABLE_NAME: table.tableName },
      bundling: { minify: true, sourceMap: true, externalModules: [], forceDockerBundling: false },
      logGroup: new logs.LogGroup(this, "BackendLogs", {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    table.grantReadWriteData(backend);
    const api = new apigateway.HttpApi(this, "Api");
    const creationRoutes = api.addRoutes({
      path: "/api/concerts",
      methods: [apigateway.HttpMethod.POST],
      integration: new HttpLambdaIntegration("CreateConcertIntegration", backend),
    });
    const groupCreationRoutes = api.addRoutes({
      path: "/api/groups",
      methods: [apigateway.HttpMethod.POST],
      integration: new HttpLambdaIntegration("CreateGroupIntegration", backend),
    });
    api.addRoutes({
      path: "/api/{proxy+}",
      methods: [apigateway.HttpMethod.ANY],
      integration: new HttpLambdaIntegration("ConcertIntegration", backend),
    });
    const apiStage = api.defaultStage?.node.defaultChild;
    if (apiStage instanceof apigateway.CfnStage) {
      apiStage.node.addDependency(...creationRoutes, ...groupCreationRoutes);
      apiStage.defaultRouteSettings = { throttlingBurstLimit: 200, throttlingRateLimit: 100 };
      apiStage.routeSettings = {
        "POST /api/concerts": { ThrottlingBurstLimit: 5, ThrottlingRateLimit: 2 },
        "POST /api/groups": { ThrottlingBurstLimit: 5, ThrottlingRateLimit: 2 },
      };
    }
    const routeRewrite = new cloudfront.Function(this, "SpaRouting", {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  if (request.uri === '/' || request.uri.indexOf('/c/') === 0 || request.uri.indexOf('/g/') === 0) {
    request.uri = '/_shell.html';
  }
  return request;
}`),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });
    const headers = new cloudfront.ResponseHeadersPolicy(this, "Headers", {
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        contentSecurityPolicy: {
          contentSecurityPolicy:
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-src 'self' https://www.youtube-nocookie.com https://open.spotify.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
          override: true,
        },
      },
      customHeadersBehavior: {
        customHeaders: [{ header: "X-Robots-Tag", value: "noindex, nofollow", override: true }],
      },
    });
    const playerHeaders = new cloudfront.ResponseHeadersPolicy(this, "PlayerHeaders", {
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.SAMEORIGIN, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        contentSecurityPolicy: {
          contentSecurityPolicy:
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src https://www.youtube-nocookie.com; frame-ancestors 'self'; base-uri 'none'",
          override: true,
        },
      },
    });
    const frontendOrigin = origins.S3BucketOrigin.withOriginAccessControl(bucket);
    const distribution = new cloudfront.Distribution(this, "Cdn", {
      domainNames: props.domain ? [productionDomain] : undefined,
      certificate: props.domain?.certificate,
      defaultBehavior: {
        origin: frontendOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: headers,
        functionAssociations: [
          { function: routeRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new origins.HttpOrigin(`${api.apiId}.execute-api.${this.region}.amazonaws.com`),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: headers,
        },
        "/player/youtube.html": {
          origin: frontendOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy: playerHeaders,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });
    if (props.domain) {
      const zone = route53.HostedZone.fromHostedZoneAttributes(this, "DomainZone", {
        hostedZoneId: props.domain.hostedZoneId,
        zoneName: productionDomain,
      });
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
      new route53.ARecord(this, "DomainA", { zone, target });
      new route53.AaaaRecord(this, "DomainAaaa", { zone, target });
    }
    const frontendPath = resolve("dist/client");
    if (!existsSync(resolve(frontendPath, "_shell.html"))) {
      throw new Error("Run pnpm build before synthesizing or deploying infrastructure.");
    }
    new deployment.BucketDeployment(this, "FrontendAssets", {
      sources: [deployment.Source.asset(frontendPath)],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ["/*"],
      cacheControl: [deployment.CacheControl.fromString("public,max-age=0,must-revalidate")],
      prune: false,
    });
    const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      "GitHubOidc",
      `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
    );
    const deployRole = new iam.Role(this, "GitHubDeployRole", {
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": `repo:RikClaessens@1387393/podiumpanda@1471985508:environment:${props.stage}`,
        },
      }),
      maxSessionDuration: Duration.hours(1),
    });
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [
          ...[this.region, ...(props.stage === "prod" ? ["us-east-1"] : [])].flatMap((region) =>
            ["deploy", "file-publishing", "lookup"].map(
              (role) =>
                `arn:aws:iam::${this.account}:role/cdk-hnb659fds-${role}-role-${this.account}-${region}`,
            ),
          ),
        ],
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["cloudformation:DescribeStacks"],
        resources: [this.region, ...(props.stage === "prod" ? ["us-east-1"] : [])].map(
          (region) => `arn:aws:cloudformation:${region}:${this.account}:stack/CDKToolkit/*`,
        ),
      }),
    );
    new CfnOutput(this, "Url", {
      value: props.domain
        ? `https://${productionDomain}`
        : `https://${distribution.distributionDomainName}`,
    });
    new CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new CfnOutput(this, "GitHubRoleArn", { value: deployRole.roleArn });
  }
}
