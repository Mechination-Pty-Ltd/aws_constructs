import { CustomResource, Duration, Stack } from "aws-cdk-lib";
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { Architecture, Runtime, Code, Function, CfnFunction } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Provider } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { readFileSync } from "fs";
import { join } from "path";

export interface DynamoItemResourceProps {
  table: ITable;
  key: Record<string, any>;
  item: Record<string, any>;
}

/**
 * Upserts a value into DynamoDB when the stack is deployed.  THis can be used to inject data that is needed for proper operation.
 */
export class DynamoItemResource extends Construct {
  private static providerHandler: Function;
  private static provider: Provider;

  constructor(scope: Construct, id: string, props: DynamoItemResourceProps) {
    super(scope, id);

    if (!DynamoItemResource.provider) {
      DynamoItemResource.providerHandler = new Function(Stack.of(this), "ItemResourceHandler", {
        memorySize: 256,
        architecture: Architecture.ARM_64,
        timeout: Duration.seconds(30),
        runtime: Runtime.NODEJS_20_X,
        logRetention: RetentionDays.THREE_MONTHS,
        handler: "index.handler",
        code: Code.fromInline(readFileSync(join(__dirname, "dynamo_resource_lambda.js")).toString("utf-8")),
      });

      DynamoItemResource.provider = new Provider(Stack.of(this), "ItemResourceProvider", {
        onEventHandler: DynamoItemResource.providerHandler,
        logRetention: RetentionDays.THREE_DAYS,
      });
      // Resource providers don't like changing logical ID, so we pin it to a specific name that hopefully nobody will re-use
      (DynamoItemResource.provider.node.children[0].node.defaultChild as CfnFunction).overrideLogicalId(
        "CustomResourceDynamoItemResourceProvider"
      );
    }

    new CustomResource(this, "Resource", {
      serviceToken: DynamoItemResource.provider.serviceToken,
      properties: {
        TableName: props.table.tableName,
        Key: props.key,
        Item: props.item,
      },
    });
    props.table.grantWriteData(DynamoItemResource.providerHandler);
  }
}
