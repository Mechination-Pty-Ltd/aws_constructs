import { Aws, CustomResource, Duration, Stack } from "aws-cdk-lib";
import { PolicyStatement, Role } from "aws-cdk-lib/aws-iam";
import { Architecture, CfnFunction, Code, Runtime } from "aws-cdk-lib/aws-lambda";
import { Function } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
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
      PrivateKeyResource.providerHandler = new Function(Stack.of(this), "PrivateKeyResourceProviderHandler", {
        memorySize: 256,
        architecture: Architecture.ARM_64,
        timeout: Duration.seconds(30),
        runtime: Runtime.NODEJS_20_X,
        logRetention: RetentionDays.THREE_MONTHS,
        handler: "index.handler",
        code: Code.fromInline(readFileSync(join(__dirname, "private_key_lambda.js")).toString("utf-8")),
      });
      PrivateKeyResource.provider = new Provider(Stack.of(this), "PrivateKeyResourceProvider", {
        onEventHandler: PrivateKeyResource.providerHandler,
        logRetention: RetentionDays.THREE_DAYS,
      });
      // Resource providers don't like changing logical ID, so we pin it to a specific name that hopefully nobody will re-use
      (PrivateKeyResource.provider.node.children[0].node.defaultChild as CfnFunction).overrideLogicalId(
        "CustomResourcePrivateKeyResourceProvider"
      );

      // Originally, I had set this up to only allow create/delete on the secrets themselves, but we have an order of execution problem, as
      // when you remove an instance of this Construct, the IAM policy will be updated _before_ the custom resource gets deleted, which will then fail because
      // it doesn't have permission.  Instead, we create secrets with a special tag, then limit our ability to delete secrets to just those with this tag
      // Sadly, this is some protection but not much, as we must provide the lambda blanket permisson to tag any secret, meaning really it could delete any
      // secret via a two step process.
      PrivateKeyResource.providerHandler?.addToRolePolicy(
        new PolicyStatement({
          actions: ["secretsmanager:CreateSecret", "secretsmanager:TagResource"],
          resources: ["*"],
        })
      );
      PrivateKeyResource.providerHandler?.addToRolePolicy(
        new PolicyStatement({
          actions: ["secretsmanager:DeleteSecret"],
          resources: ["*"],
          conditions: {
            StringEquals: {
              "secretsmanager:ResourceTag/CreatedBy": "CustomResourcePrivateKeyResourceProvider",
            },
          },
        })
      );
    }

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
