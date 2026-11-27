import { App } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { DomainCertificateStack } from "./domain";
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
        Aliases: Match.absent(),
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

  it("uses a DNS-validated us-east-1 certificate and Route 53 aliases only for production", () => {
    const account = "123456789012";
    const hostedZoneId = "Z123456789EXAMPLE";
    const app = new App({
      context: {
        [`hosted-zone:account=${account}:domainName=podiumpanda.com:privateZone=false:region=us-east-1`]:
          { Id: hostedZoneId, Name: "podiumpanda.com." },
      },
    });
    const certificate = new DomainCertificateStack(app, "Certificate", {
      env: { account, region: "us-east-1" },
      crossRegionReferences: true,
    });
    const stack = new PodiumPandaStack(app, "Prod", {
      stage: "prod",
      env: { account, region: "eu-west-1" },
      crossRegionReferences: true,
      domain: { hostedZoneId: certificate.hostedZoneId, certificate: certificate.certificate },
    });
    const cert = Template.fromStack(certificate);
    const prod = Template.fromStack(stack);
    expect(cert.findResources("AWS::Route53::HostedZone")).toEqual({});
    expect(prod.findResources("AWS::Route53::HostedZone")).toEqual({});
    cert.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "podiumpanda.com",
      ValidationMethod: "DNS",
      DomainValidationOptions: [{ DomainName: "podiumpanda.com", HostedZoneId: hostedZoneId }],
    });
    prod.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Aliases: ["podiumpanda.com"],
        ViewerCertificate: Match.objectLike({ AcmCertificateArn: Match.anyValue() }),
      }),
    });
    for (const type of ["A", "AAAA"]) {
      prod.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: "podiumpanda.com.",
        HostedZoneId: hostedZoneId,
        Type: type,
        AliasTarget: Match.objectLike({
          DNSName: Match.anyValue(),
          HostedZoneId: Match.anyValue(),
        }),
      });
    }
    prod.hasOutput("Url", { Value: "https://podiumpanda.com" });
    expect(JSON.stringify(prod.toJSON().Mappings)).toContain("Z2FDTNDATAQYW2");
    const policies = JSON.stringify(prod.findResources("AWS::IAM::Policy"));
    expect(policies).toContain("cdk-hnb659fds-deploy-role-123456789012-us-east-1");
    expect(policies).toContain("cdk-hnb659fds-lookup-role-123456789012-us-east-1");
    expect(policies).toContain("cdk-hnb659fds-file-publishing-role-123456789012-eu-west-1");
    prod.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Condition: {
              StringEquals: {
                "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                "token.actions.githubusercontent.com:sub":
                  "repo:RikClaessens/podiumpanda:environment:prod",
              },
            },
          }),
        ]),
      }),
    });
    expect(() => new PodiumPandaStack(app, "Invalid", { stage: "prod" })).toThrow(
      "The production stage requires a domain",
    );
  });

  it("requests a public hosted-zone lookup in the certificate region", () => {
    const app = new App();
    new DomainCertificateStack(app, "Certificate", {
      env: { account: "123456789012", region: "us-east-1" },
    });
    expect(app.synth().manifest.missing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "hosted-zone",
          props: expect.objectContaining({
            domainName: "podiumpanda.com",
            privateZone: false,
            account: "123456789012",
            region: "us-east-1",
          }),
        }),
      ]),
    );
  });
});
