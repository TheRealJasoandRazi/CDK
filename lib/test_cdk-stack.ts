import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class TestCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'MyVpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [//THIS IS FOR BOTH AVAILABILITY ZONES
        {
          //WILL HAVE NAT GATEWAY AND ALB HERE
          subnetType: ec2.SubnetType.PUBLIC,
          name: 'PublicSubnet',
          cidrMask: 24,
        },
        {
          //FARGATE TASKS IN THESE 2
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          name: 'PrivateSubnetA',
          cidrMask: 24,
        },
        {
          //AURORA DB AND REPLICA IN THESE 2
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          name: 'PrivateSubnetC',
          cidrMask: 24,
        },
      ]
    });

    new cdk.CfnOutput(this, 'VpcId', { //LEVEL 1 CONSTRUCT
      value: vpc.vpcId
    });
  }
}
