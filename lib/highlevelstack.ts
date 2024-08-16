import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class highlevelstack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

///////////////////////////////////////////////////////////////////////////
/////////////////////////////// VPC ///////////////////////////////////////
///////////////////////////////////////////////////////////////////////////

    const vpc = new ec2.Vpc(this, 'Seedragon_VPC', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'), 
      maxAzs: 2, 
      natGateways: 1, 
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'IsolatedSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    }