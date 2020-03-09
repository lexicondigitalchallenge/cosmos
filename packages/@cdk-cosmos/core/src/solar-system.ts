import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { IVpc, SubnetType, Vpc, GatewayVpcEndpointAwsService, InterfaceVpcEndpointAwsService } from '@aws-cdk/aws-ec2';
import { IHostedZone, HostedZone } from '@aws-cdk/aws-route53';
import {
  RESOLVE,
  PATTERN,
  Bubble,
  Galaxy,
  GalaxyExtension,
  SolarSystem,
  SolarSystemExtension,
  RemoteVpc,
  RemoteZone,
} from '.';

const stackName = (galaxy: Bubble, name: string): string =>
  RESOLVE(PATTERN.SOLAR_SYSTEM, 'SolarSystem', { Name: name, Galaxy: galaxy });

export interface SolarSystemProps extends StackProps {
  cidr?: string;
}

export class SolarSystemStack extends Stack implements SolarSystem {
  readonly Galaxy: Galaxy;
  readonly Name: string;
  readonly Vpc: Vpc;
  readonly Zone: HostedZone;

  constructor(galaxy: Galaxy, name: string, props?: SolarSystemProps) {
    super(galaxy.Cosmos.Scope, stackName(galaxy, name), {
      ...props,
      env: {
        account: props?.env?.account || galaxy.account,
        region: props?.env?.region || galaxy.region,
      },
    });

    const { cidr } = props || {};

    this.Galaxy = galaxy;
    this.Galaxy.AddSolarSystem(this);
    this.Name = name;

    this.Vpc = this.Galaxy.node.tryFindChild('SharedVpc') as Vpc;
    if (!this.Vpc) {
      if (!cidr) {
        throw new Error(`Cidr is required for first app env defined in the galaxy (Env: ${this.Name}?).`);
      }

      this.Vpc = new Vpc(this.Galaxy, 'SharedVpc', {
        cidr: cidr,
        maxAzs: 3,
        subnetConfiguration: [
          {
            name: 'Main',
            subnetType: SubnetType.ISOLATED,
            cidrMask: 26,
          },
        ],
      });

      // TODO: move to internet endpoint Endpoints ?
      this.Vpc.addGatewayEndpoint('S3Gateway', {
        service: GatewayVpcEndpointAwsService.S3,
        subnets: [this.Vpc.selectSubnets({ onePerAz: true })],
      });
      this.Vpc.addInterfaceEndpoint('EcsEndpoint', {
        service: InterfaceVpcEndpointAwsService.ECS,
      });
      this.Vpc.addInterfaceEndpoint('EcsAgentEndpoint', {
        service: InterfaceVpcEndpointAwsService.ECS_AGENT,
      });
      this.Vpc.addInterfaceEndpoint('EcsTelemetryEndpoint', {
        service: InterfaceVpcEndpointAwsService.ECS_TELEMETRY,
      });
      this.Vpc.addInterfaceEndpoint('EcrEndpoint', {
        service: InterfaceVpcEndpointAwsService.ECR,
      });
      this.Vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
        service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
      });

      RemoteVpc.export(this.Vpc, RESOLVE(PATTERN.SINGLETON_GALAXY, 'SharedVpc', this));
    }

    const rootZoneName = this.Galaxy.Cosmos.RootZone.zoneName;
    this.Zone = new HostedZone(this, 'Zone', {
      zoneName: `${name}.${rootZoneName}`.toLowerCase(),
    });

    // new ZoneDelegationRecord(this, 'ZoneDelegation', {
    //   zone: this.Account.Project.Zone,
    //   recordName: this.Zone.zoneName,
    //   nameServers: this.Zone.hostedZoneNameServers as string[],
    // }); // TODO: Cross Account ZoneDelegationRecord

    RemoteZone.export(this.Zone, RESOLVE(PATTERN.SINGLETON_SOLAR_SYSTEM, 'Zone', this));
  }
}

export class ImportedSolarSystem extends Construct implements SolarSystem {
  readonly Galaxy: Galaxy;
  readonly Name: string;
  readonly Vpc: IVpc;
  readonly Zone: IHostedZone;

  constructor(scope: Construct, galaxy: Galaxy, name: string) {
    super(scope, 'SolarSystemImport');

    this.Galaxy = galaxy;
    this.Name = name;
    this.Vpc = RemoteVpc.import(this, RESOLVE(PATTERN.SINGLETON_GALAXY, 'SharedVpc', this), { hasIsolated: true });
    this.Zone = RemoteZone.import(this, RESOLVE(PATTERN.SINGLETON_SOLAR_SYSTEM, 'Zone', this));
  }
}

export class SolarSystemExtensionStack extends Stack implements SolarSystemExtension {
  readonly Galaxy: GalaxyExtension;
  readonly Portal: SolarSystem;
  readonly Name: string;

  constructor(galaxy: GalaxyExtension, name: string, props?: StackProps) {
    super(galaxy.Cosmos.Scope, stackName(galaxy, name), {
      ...props,
      env: {
        account: props?.env?.account || galaxy.account,
        region: props?.env?.region || galaxy.region,
      },
    });

    this.Galaxy = galaxy;
    this.Galaxy.AddSolarSystem(this);
    this.Name = name;
    this.Portal = new ImportedSolarSystem(this, this.Galaxy.Portal, this.Name);
  }
}