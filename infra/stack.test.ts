import { App } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { PodiumPandaStack } from "./stack";

describe("serverless deployment", () => {
  it("keeps S3 private, retains recoverable data and isolates uncached authenticated backend requests", () => {
    const app = new App();
    const stack = new PodiumPandaStack(app, "Test", {
      stage: "dev",
      env: { account: "123456789012", region: "eu-west-1" },
    });
    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    template.hasResource("AWS::DynamoDB::Table", {
      DeletionPolicy: "Retain",
      Properties: Match.objectLike({
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      }),
    });
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({
            PathPattern: "/api/*",
            CachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
            OriginRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac",
          }),
          Match.objectLike({ PathPattern: "/player/youtube.html" }),
        ]),
      }),
    });
    template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: Match.objectLike({
          ContentSecurityPolicy: {
            ContentSecurityPolicy: Match.stringLikeRegexp(
              "frame-src 'self' https://www\\.youtube-nocookie\\.com https://open\\.spotify\\.com;",
            ),
            Override: true,
          },
        }),
      }),
    });
    template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: Match.objectLike({
          FrameOptions: { FrameOption: "SAMEORIGIN", Override: true },
          ContentSecurityPolicy: Match.objectLike({
            ContentSecurityPolicy: Match.stringLikeRegexp("frame-ancestors 'self'"),
          }),
        }),
      }),
    });
    template.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "sts:AssumeRoleWithWebIdentity",
            Condition: {
              StringEquals: {
                "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                "token.actions.githubusercontent.com:sub":
                  "repo:RikClaessens/podiumpanda:environment:dev",
              },
            },
          }),
        ]),
      }),
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      RouteSettings: {
        "POST /api/concerts": { ThrottlingBurstLimit: 5, ThrottlingRateLimit: 2 },
        "POST /api/groups": { ThrottlingBurstLimit: 5, ThrottlingRateLimit: 2 },
      },
    });
    const creationRoute = Object.keys(
      template.findResources("AWS::ApiGatewayV2::Route", {
        Properties: { RouteKey: "POST /api/concerts" },
      }),
    )[0];
    template.hasResource("AWS::ApiGatewayV2::Stage", {
      DependsOn: Match.arrayWith([creationRoute]),
    });
    expect(template.findResources("AWS::ECS::Service")).toEqual({});
  });
});
