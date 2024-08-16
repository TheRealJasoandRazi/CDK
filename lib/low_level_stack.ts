import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class low_level_stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC with a specific CIDR block
    const vpc = new ec2.CfnVPC(this, 'MyVpc', {
      cidrBlock: '10.0.0.0/16',
      enableDnsSupport: true,
      enableDnsHostnames: true,
    });

    const internetGateway = new ec2.CfnInternetGateway(this, 'MyInternetGateway', {});

    new ec2.CfnVPCGatewayAttachment(this, 'MyVpcGatewayAttachment', {
      vpcId: vpc.ref,
      internetGatewayId: internetGateway.ref
    });

    // Note: Availability zones need to be manually specified since CfnVPC doesn't provide availability zones directly.
    const az1 = 'ap-southeast-2a'; // Change this to the appropriate availability zone for your region.

    const privateRouteTable = new ec2.CfnRouteTable(this, 'PrivateRouteTable', {
      vpcId: vpc.ref,
    });

    const privateRouteTable_WithNATGateway = new ec2.CfnRouteTable(this, 'PrivateRouteTable_WithNATGateway', {
      vpcId: vpc.ref,
    });

    const publicRouteTable = new ec2.CfnRouteTable(this, 'PublicRouteTable', {
      vpcId: vpc.ref,
    });

    const publicSubnet = new ec2.CfnSubnet(this, 'PublicSubnet', {
      vpcId: vpc.ref,
      cidrBlock: '10.0.1.0/24',
      availabilityZone: az1,
      mapPublicIpOnLaunch: true,
    });

    const privateSubnetA1 = new ec2.CfnSubnet(this, 'PrivateSubnetA1', {
      vpcId: vpc.ref,
      cidrBlock: '10.0.2.0/24',
      availabilityZone: az1,
    });

    const privateSubnetA2 = new ec2.CfnSubnet(this, 'PrivateSubnetA2', {
      vpcId: vpc.ref,
      cidrBlock: '10.0.3.0/24',
      availabilityZone: az1,
    });

    new ec2.CfnSubnetRouteTableAssociation(this, 'PrivateSubnetAssociation', {
      subnetId: privateSubnetA1.ref,
      routeTableId: privateRouteTable.ref,
    });

    new ec2.CfnSubnetRouteTableAssociation(this, 'PublicSubnetAssociation', {
      subnetId: publicSubnet.ref,
      routeTableId: publicRouteTable.ref,
    });

    const eip = new ec2.CfnEIP(this, 'EIP', {});

    const natGateway = new ec2.CfnNatGateway(this, 'NatGateway', {
      subnetId: publicSubnet.ref,
      allocationId: eip.ref,
    });

    new ec2.CfnSubnetRouteTableAssociation(this, 'PrivateSubnetAssociationWithNATGateway', {
      subnetId: privateSubnetA2.ref,
      routeTableId: privateRouteTable_WithNATGateway.ref,
    });

    new ec2.CfnRoute(this, 'RouteToNatGateway', {
      routeTableId: privateRouteTable_WithNATGateway.ref,
      destinationCidrBlock: '0.0.0.0/0',
      natGatewayId: natGateway.ref,
    });

    new ec2.CfnRoute(this, 'RouteToInternetGateway', {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: internetGateway.ref,
    });

    new cdk.CfnOutput(this, 'Seedragon_VPC', {
      value: vpc.ref,
    });
  }
}
