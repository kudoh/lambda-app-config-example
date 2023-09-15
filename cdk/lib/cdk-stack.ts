import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { FunctionUrlAuthType, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as appConfig from 'aws-cdk-lib/aws-appconfig';
import { Effect } from 'aws-cdk-lib/aws-iam';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const stage = this.node.tryGetContext('stage') || 'local';

    // AWS AppConfig(Featureフラグ自体はマネジメントコンソールで操作)
    const configApp = new appConfig.CfnApplication(this, 'AppConfigSample', {
      name: 'sample-app'
    });
    const devEnv = new appConfig.CfnEnvironment(this, 'AppConfigDev', {
      name: 'dev',
      applicationId: configApp.ref
    });
    const appConfigDefault = new appConfig.CfnConfigurationProfile(this, 'AppConfigDefaultProfile', {
      name: 'default',
      applicationId: configApp.ref,
      type: 'AWS.AppConfig.FeatureFlags',
      locationUri: 'hosted'
    });

    // Lambda関数
    const sampleLambda = new nodejsLambda.NodejsFunction(this, 'SampleLambda', {
      entry: '../app/handler.ts',
      handler: 'sample',
      runtime: Runtime.NODEJS_18_X,
      functionName: 'sample-function',
      logRetention: RetentionDays.ONE_DAY,
      environment: {
        STAGE: stage,
        AWS_APPCONFIG_EXTENSION_LOG_LEVEL: 'debug'
      }
    });
    const url = sampleLambda.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE
    });

    // AWS AppConfig ExtensionをLambdaに追加
    // Arn for ap-northeast-1(x86-64 arch)
    // see https://docs.aws.amazon.com/appconfig/latest/userguide/appconfig-integration-lambda-extensions-versions.html#appconfig-integration-lambda-extensions-enabling-x86-64
    const extensionArn = 'arn:aws:lambda:ap-northeast-1:980059726660:layer:AWS-AppConfig-Extension:84';
    sampleLambda.addLayers(LayerVersion.fromLayerVersionArn(this, 'AppConfigExtension', extensionArn));
    // AppConfig Extensionの実行ロール
    const appConfigRole = new iam.Role(this, 'AppConfigExtensionRole', {
      roleName: 'AppConfigExtensionRole',
      assumedBy: sampleLambda.grantPrincipal, // 利用するLambdaで引き受け可能
      inlinePolicies: {
        UserTablePut: new iam.PolicyDocument({
          statements: [new iam.PolicyStatement({
            actions: ['appconfig:StartConfigurationSession', 'appconfig:GetLatestConfiguration'],
            effect: Effect.ALLOW,
            resources: [`arn:aws:appconfig:${this.region}:${this.account}:application/${configApp.ref}/environment/${devEnv.ref}/configuration/${appConfigDefault.ref}`]
          })]
        })
      }
    });
    sampleLambda.addEnvironment('AWS_APPCONFIG_EXTENSION_ROLE_ARN', appConfigRole.roleArn);

    new cdk.CfnOutput(this, 'LambdaUrl', {
      value: url.url
    });
  }
}
