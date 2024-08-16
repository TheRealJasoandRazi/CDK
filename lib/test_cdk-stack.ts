import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { IpAddresses } from 'aws-cdk-lib/aws-ec2';

export class TestCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC with a specific CIDR block
    /*const vpc = new ec2.Vpc(this, 'MyVpc', {
      ipAddresses: IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 1, //Automatically creates subnets, 2 per AZ
    });*/

    const vpc = new ec2.CfnVPC(this, 'MyVpc', {
      cidrBlock: '10.0.0.0/16',
      enableDnsSupport: true,
      enableDnsHostnames: true,
    });

    const internetGateway = new ec2.CfnInternetGateway(this, 'MyInternetGateway', {});

    new ec2.CfnVPCGatewayAttachment(this, 'MyVpcGatewayAttachment', {
      vpcId: vpc.vpcId,
      internetGatewayId: internetGateway.ref
    });

    const az1 = vpc.availabilityZones[0];
    //const az2 = vpc.availabilityZones[1];

    const privateRouteTable = new ec2.CfnRouteTable(this, 'PrivateRouteTable', {
      vpcId: vpc.vpcId,
    });

    const privateRouteTable_WithNATGateway = new ec2.CfnRouteTable(this, 'PrivateRouteTable_WithNATGateway', {
      vpcId: vpc.vpcId,
    });

    const publicRouteTable = new ec2.CfnRouteTable(this, 'PublicRouteTable', {
      vpcId: vpc.vpcId,
    });

    ///////////////////////////////////////////////////////////////////
    /////////////////////  AVAILABILITY ZONE A  ///////////////////////
    ///////////////////////////////////////////////////////////////////
    const public_subnet = new ec2.PublicSubnet(this, 'Public_Subnet', {
      vpcId: vpc.vpcId,
      cidrBlock: '10.0.1.0/24',
      availabilityZone: az1,
      mapPublicIpOnLaunch: true, //associates an ip to an instance at launch
    });

    const private_subnet_a_1 = new ec2.PrivateSubnet(this, "Private_Subnet_A_1", {
      vpcId: vpc.vpcId,
      cidrBlock: '10.0.2.0/24',
      availabilityZone: az1,
    });

    //THIS ONE NEEDS INTERNET CONNECTIVITY, WHERE ECS INSTANCES WILL BE
    const private_subnet_a_2 = new ec2.PrivateSubnet(this, "Private_Subnet_A_2", {
      vpcId: vpc.vpcId,
      cidrBlock: '10.0.3.0/24',
      availabilityZone: az1,
    });

    new ec2.CfnSubnetRouteTableAssociation(this, 'PrivateSubnetAssociation', {
      subnetId: private_subnet_a_1.subnetId,
      routeTableId: privateRouteTable.ref,
    });

    new ec2.CfnSubnetRouteTableAssociation(this, "PublicSubnetAssociation", {
      subnetId: public_subnet.subnetId,
      routeTableId: publicRouteTable.ref
    })

    const nat_gateway = new ec2.CfnNatGateway(this, "Nat_Gateway", {
      subnetId: public_subnet.subnetId,
      allocationId: new ec2.CfnEIP(this, 'EIP', {}).ref, // Create an Elastic IP for the NAT Gateway
    });

    new ec2.CfnSubnetRouteTableAssociation(this, 'PrivateSubnetAssociation_WithNATGateway', {
      subnetId: private_subnet_a_2.subnetId,
      routeTableId: privateRouteTable_WithNATGateway.ref,
    });

    new ec2.CfnRoute(this, 'RouteToNatGateway', {
      routeTableId: privateRouteTable_WithNATGateway.ref,
      destinationCidrBlock: '0.0.0.0/0',
      natGatewayId: nat_gateway.ref
    });

    new ec2.CfnRoute(this, 'RouteToInternetGateway', {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: internetGateway.ref,
    });
    
    new cdk.CfnOutput(this, 'Seedragon_VPC', { //ID, makes it easier to read
      value: vpc.vpcId
    });
  }
}
