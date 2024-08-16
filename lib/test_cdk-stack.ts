import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class TestCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'MyVpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 1,
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: 'PublicSubnet',
          cidrMask: 24,
        },
        {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          name: 'PrivateSubnetC',
          cidrMask: 24,
        },
        {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          name: 'PrivateSubnetA',
          cidrMask: 24,
        },
      ],
    });

    const publicSubnet = vpc.publicSubnets[0];
    const privateSubnetA1 = vpc.privateSubnets[0];
    const privateSubnetA2 = vpc.privateSubnets[1];

    const internetGateway = new ec2.CfnInternetGateway(this, 'MyInternetGateway', {});

    new ec2.CfnVPCGatewayAttachment(this, 'MyVpcGatewayAttachment', {
      vpcId: vpc.vpcId,
      internetGatewayId: internetGateway.ref,
    });

    const publicRouteTable = new ec2.CfnRouteTable(this, 'PublicRouteTable', {
      vpcId: vpc.vpcId,
    });

    new ec2.CfnRoute(this, 'RouteToInternetGateway', {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: internetGateway.ref,
    });

    new ec2.CfnSubnetRouteTableAssociation(this, 'PublicSubnetAssociation', {
      subnetId: publicSubnet.subnetId,
      routeTableId: publicRouteTable.ref,
    });

    const eip = new ec2.CfnEIP(this, 'EIP', {});
    
    const natGateway = new ec2.CfnNatGateway(this, 'NatGateway', {
      subnetId: publicSubnet.subnetId,
      allocationId: eip.ref,
    });

    const privateRouteTableWithNATGateway = new ec2.CfnRouteTable(this, 'PrivateRouteTableWithNATGateway', {
      vpcId: vpc.vpcId,
    });

    new ec2.CfnRoute(this, 'RouteToNATGateway', {
      routeTableId: privateRouteTableWithNATGateway.ref,
      destinationCidrBlock: '0.0.0.0/0',
      natGatewayId: natGateway.ref,
    });

    new ec2.CfnSubnetRouteTableAssociation(this, 'PrivateSubnetA1Association', {
      subnetId: privateSubnetA1.subnetId,
      routeTableId: privateRouteTableWithNATGateway.ref,
    });

    new ec2.CfnSubnetRouteTableAssociation(this, 'PrivateSubnetA2Association', {
      subnetId: privateSubnetA2.subnetId,
      routeTableId: privateRouteTableWithNATGateway.ref,
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
    });

    new cdk.CfnOutput(this, 'InternetGatewayId', {
      value: internetGateway.ref,
    });

    new cdk.CfnOutput(this, 'NATGatewayId', {
      value: natGateway.ref,
    });
  }
}
