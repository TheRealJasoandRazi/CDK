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
    });

    const nacl = new ec2.NetworkAcl(this, 'MyNACL', {
        vpc: vpc,
        subnetSelection: { //only private subnets are associated
            subnets: vpc.selectSubnets().subnets
        }
    });

    nacl.addEntry('AllowInboundHTTPS', {
        ruleNumber: 100,
        cidr: ec2.AclCidr.anyIpv4(),
        traffic: ec2.AclTraffic.tcpPort(443),
        direction: ec2.TrafficDirection.INGRESS,
        ruleAction: ec2.Action.ALLOW,
    });

    nacl.addEntry('AllowOutboundHTTPS', {
        ruleNumber: 101,
        cidr: ec2.AclCidr.anyIpv4(),
        traffic: ec2.AclTraffic.tcpPort(443),
        direction: ec2.TrafficDirection.EGRESS,
        ruleAction: ec2.Action.ALLOW,
    });

    const ALB_SG = new ec2.SecurityGroup(this, 'ALB_SG', {
        vpc: vpc,
        description: 'Security group for ALB',
      });
     
      const Fargate_Task_SG = new ec2.SecurityGroup(this, 'Fargate_Task_SG', {
        vpc: vpc,
        description: 'Security group for Fargate tasks',
      });
  
      ALB_SG.addEgressRule(
        ec2.Peer.securityGroupId(Fargate_Task_SG.securityGroupId),
        ec2.Port.tcp(443), 
        'Allow traffic to Fargate tasks'
      );
  
      Fargate_Task_SG.addIngressRule(
        ec2.Peer.securityGroupId(ALB_SG.securityGroupId),
        ec2.Port.tcp(443),
        'Allow traffic from ALB'
      );

///////////////////////////////////////////////////////////////////////////
/////////////////////////////// ID's //////////////////////////////////////
///////////////////////////////////////////////////////////////////////////

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
    });
  }
}
