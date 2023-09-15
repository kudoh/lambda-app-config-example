import { APIGatewayProxyHandler } from 'aws-lambda';

type FeatureFlags = {
  [name: string]: {
    enabled: boolean;
  }
}
export const sample: APIGatewayProxyHandler = async (event, context) => {
  // AppConfig ExtensionからFeatureフラグ取得
  const appName = 'sample-app';
  const env = process.env.STAGE;
  const profile = 'default';
  const resp = await fetch(`http://localhost:2772/applications/${appName}/environments/${env}/configurations/${profile}`);
  const flags: FeatureFlags = await resp.json();

  return {
    statusCode: 200,
    body: JSON.stringify({
      flags: {
        featureA: flags.featureA.enabled,
        featureB: flags.featureB.enabled
      }
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};
