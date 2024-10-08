import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as rds from 'aws-cdk-lib/aws-rds';

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
                name: 'FargateSubnet',
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            {
                cidrMask: 24,
                name: 'DatabaseSubnet',
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
        ],
    });

    const nacl = new ec2.NetworkAcl(this, 'MyNACL', {
        vpc: vpc,
        networkAclName: "Seedragon NACL",
        subnetSelection: { //only private subnets are associated
            availabilityZones: vpc.availabilityZones,
        }
    }); //create a second NACL?

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
        allowAllOutbound: false,
    });
     
    const Fargate_Task_SG = new ec2.SecurityGroup(this, 'Fargate_Task_SG', {
        vpc: vpc,
        description: 'Security group for Fargate tasks',
        allowAllOutbound: false,
    });

    const EFS_Mount_SG = new ec2.SecurityGroup(this, 'EFS_Mount_SG', {
        vpc: vpc,
        description: 'Security group for EFS Mounts',
        allowAllOutbound: false,
    });

    const Aurora_SG = new ec2.SecurityGroup(this, 'Aurora_SG', {
        vpc: vpc,
        description: 'Security group for Aurora DB',
        allowAllOutbound: false,
    });
  
    ALB_SG.addEgressRule( //Security group id is probably not initialised yet, so pass in const instead
        Fargate_Task_SG,
        //ec2.Peer.securityGroupId(Fargate_Task_SG.securityGroupId),
        ec2.Port.tcp(443), 
    );

    ALB_SG.addIngressRule( 
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(443), 
    );

    Fargate_Task_SG.addIngressRule(
        ALB_SG,
        ec2.Port.tcp(443),
    );

    Fargate_Task_SG.addIngressRule(
        Aurora_SG,
        ec2.Port.tcp(5432)
    );

    Fargate_Task_SG.addEgressRule(
        Aurora_SG,
        ec2.Port.tcp(5432)
    );

    Fargate_Task_SG.addEgressRule(
        EFS_Mount_SG,
        ec2.Port.tcp(2049)
    );

    Fargate_Task_SG.addIngressRule(
        EFS_Mount_SG,
        ec2.Port.tcp(2049)
    );

    EFS_Mount_SG.addEgressRule(
        Fargate_Task_SG,
        ec2.Port.tcp(2049)
    );

    EFS_Mount_SG.addIngressRule(
        Fargate_Task_SG,
        ec2.Port.tcp(2049)
    );

    Aurora_SG.addEgressRule(
        Fargate_Task_SG,
        ec2.Port.tcp(5432)
    );

    Aurora_SG.addIngressRule(
        Fargate_Task_SG,
        ec2.Port.tcp(5432)
    );

    //TO ADD
    // rules for traffic to/from nat gateway and lambda

    const Application_Load_Balancer = new elbv2.ApplicationLoadBalancer(this, 'Application_Load_Balancer', {
        vpc,
        internetFacing: true,
        loadBalancerName: "Seedragon-load-balancer",
        securityGroup: ALB_SG,
    });

    //TO ADD
    //Listeners and targets for fargate  
    //route53 for the DNS "Seedragon.org"

///////////////////////////////////////////////////////////////////////////
/////////////////////////// Aurora DB /////////////////////////////////////
///////////////////////////////////////////////////////////////////////////

    // Chnage the credentials to whatever, should use AWS Secrets Manager though
    const credentials = rds.Credentials.fromPassword('testuser', new cdk.SecretValue('testpass'));

    // Aurora Serverless Postgre
    const auroraCluster = new rds.ServerlessCluster(this, 'SeedragonAuroraDB', {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
            version: rds.AuroraPostgresEngineVersion.VER_13_4,
        }),
        vpc,
        vpcSubnets: {
            subnetGroupName: 'DatabaseSubnet',
        },
        scaling: { //ACU = 2gb of memory
            //autoPause: cdk.Duration.minutes(10),
            minCapacity: rds.AuroraCapacityUnit.ACU_2,
            maxCapacity: rds.AuroraCapacityUnit.ACU_8,
        },
        credentials: credentials,
        defaultDatabaseName: 'SeedragonAuroraDB', 
        securityGroups: [Aurora_SG],
        //removalPolicy: cdk.RemovalPolicy.RETAIN, // When CDK destroy occurs, this stays
    });
    //TO ADD
    //Code to automate the intialisation process (fargate or lambda)

///////////////////////////////////////////////////////////////////////////
//////////////////////// LAMBDA + EventBridge /////////////////////////////
///////////////////////////////////////////////////////////////////////////

    const lambdaFunction = new lambda.Function(this, 'lambda-function', {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(5),
        handler: 'index.main',
        environment: {
        REGION: 'ap-southeast-2',
        AVAILABILITY_ZONES: JSON.stringify(
                cdk.Stack.of(this).availabilityZones,
            ),
        },
        //Placeholder code
        code: lambda.Code.fromInline(` 
            exports.main = async function(event, context) {
            return "Hello, World!";
            };
        `),
    });
    //TO ADD
    //Lambda needs a deploymnet package with script, libs and datasets.csv
    //code: lambda.Code.fromAsset('path/to/your/deployment/package.zip'), // Specify the path to the ZIP file

    const rule = new events.Rule(this, 'Rule', {
        schedule: events.Schedule.rate(cdk.Duration.hours(1)),
    });

    rule.addTarget(new targets.LambdaFunction(lambdaFunction));
    //TO ADD
    //Rule to trigger lambda when AuroraDB is first initialised

///////////////////////////////////////////////////////////////////////////
/////////////////////////////// ID's //////////////////////////////////////
///////////////////////////////////////////////////////////////////////////

    new cdk.CfnOutput(this, 'VpcId', { //Prints out values to when deployed
      value: vpc.vpcId,
    });
  }
}
