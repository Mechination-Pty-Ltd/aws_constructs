import { Aws, CustomResource, Duration } from "aws-cdk-lib";
import { PolicyStatement, Role } from "aws-cdk-lib/aws-iam";
import { Architecture, Code, Runtime } from "aws-cdk-lib/aws-lambda";
import { Function } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Provider } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { readFileSync } from "fs";
import { join } from "path";

export interface PrivateKeyResourceProps {
  secretId: string;
  description?: string;
  additionalProperties?: Record<string, string>;
}

export class PrivateKeyResource extends Construct {
  static provider: Provider | undefined = undefined;
  static providerHandler: Function | undefined = undefined;
  kid: string;
  public_key: string;

  constructor(scope: Construct, id: string, props: PrivateKeyResourceProps) {
    super(scope, id);

    if (!PrivateKeyResource.provider) {
      PrivateKeyResource.providerHandler = new Function(this, "PrivateKeyResourceProviderHandler", {
        memorySize: 256,
        architecture: Architecture.ARM_64,
        timeout: Duration.seconds(30),
        runtime: Runtime.NODEJS_20_X,
        logRetention: RetentionDays.THREE_MONTHS,
        handler: "index.handler",
        code: Code.fromInline(readFileSync(join(__dirname, "private_key_lambda.js")).toString("utf-8")),
      });

      PrivateKeyResource.provider = new Provider(this, "PrivateKeyResourceProvider", {
        onEventHandler: PrivateKeyResource.providerHandler,
        logRetention: RetentionDays.THREE_DAYS,
      });
    }

    PrivateKeyResource.providerHandler?.addToRolePolicy(
      new PolicyStatement({
        actions: ["secretsmanager:CreateSecret", "secretsmanager:DeleteSecret"],
        resources: ["*"], // [`arn:${Aws.PARTITION}:secretsmanager:${Aws.REGION}:${Aws.ACCOUNT_ID}:secret:${props.secretId}`],
      })
    );

    const res = new CustomResource(this, "CustomResource", {
      serviceToken: PrivateKeyResource.provider.serviceToken,
      properties: {
        additionalProperties: props.additionalProperties,
        SecretId: props.secretId,
        Description: props.description || "Secret key for JWKS",
      },
    });

    this.kid = res.getAttString("kid");
    this.public_key = res.getAttString("publicKeyPEM");
  }
}
