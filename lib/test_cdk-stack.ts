import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { ViaServicePrincipal } from 'aws-cdk-lib/aws-kms';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class TestCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'MyVpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 1,
      //natGateways: 1,
      /*subnetConfiguration: [//THIS IS FOR BOTH AVAILABILITY ZONES
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
      ]*/
    });
    //const az1 = 'ap-southeast-2a';
    //const az2 = 'ap-southeast-2b';
    const az1 = vpc.availabilityZones[0];
    //const az2 = vpc.availabilityZones[1];

    const privateRouteTable = new ec2.CfnRouteTable(this, 'PrivateRouteTable', {
      vpcId: vpc.vpcId,
    });

    const privateRouteTable_WithNATGateway = new ec2.CfnRouteTable(this, 'PrivateRouteTable_WithNATGateway', {
      vpcId: vpc.vpcId,
    });

    ///////////////////////////////////////////////////////////////////
    /////////////////////  AVAILABILITY ZONE A  ///////////////////////
    ///////////////////////////////////////////////////////////////////
    const public_subnet = new ec2.PublicSubnet(this, 'Public_Subnet', {
      vpcId: vpc.vpcId,
      cidrBlock: '10.0.1.0/24',
      availabilityZone: az1,
      //mapPublicIpOnLaunch: true, //associates an ip to an instance at launch
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

    const nat_gateway = new ec2.CfnNatGateway(this, "Nat_Gateway", {
      subnetId: public_subnet.subnetId,
      allocationId: new ec2.CfnEIP(this, 'EIP', {}).ref, // Create an Elastic IP for the NAT Gateway
    });

    new ec2.CfnSubnetRouteTableAssociation(this, 'PrivateSubnetAssociation', {
      subnetId: private_subnet_a_2.subnetId,
      routeTableId: privateRouteTable_WithNATGateway.ref,
    });

    new ec2.CfnRoute(this, 'RouteToNatGateway', {
      routeTableId: privateRouteTable_WithNATGateway.ref,
      destinationCidrBlock: '0.0.0.0/0',
      natGatewayId: nat_gateway.ref
    });

    

    new cdk.CfnOutput(this, 'VpcId', { //LEVEL 1 CONSTRUCT
      value: vpc.vpcId
    });
  }
}
