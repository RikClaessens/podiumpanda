import { Stack, type StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";

export const productionDomain = "podiumpanda.com";

export class DomainCertificateStack extends Stack {
  readonly certificate: acm.Certificate;
  readonly hostedZoneId: string;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    const zone = route53.HostedZone.fromLookup(this, "Zone", {
      domainName: productionDomain,
      privateZone: false,
    });
    this.hostedZoneId = zone.hostedZoneId;
    this.certificate = new acm.Certificate(this, "Certificate", {
      domainName: productionDomain,
      validation: acm.CertificateValidation.fromDns(zone),
    });
  }
}
