import { marshall } from "@aws-sdk/util-dynamodb";
import { CustomResource, Duration } from "aws-cdk-lib";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { Architecture, Runtime, Code, Function } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { AwsCustomResource, AwsCustomResourcePolicy, AwsSdkCall, PhysicalResourceId, Provider } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { PrivateKeyResource } from "./PrivateKeySecret";

export interface DynamoItemResourceProps {
  table: Table;
  key: Record<string, any>;
  item: Record<string, any>;
}

const hashKey = (key: Record<string, any>) => {
  createHash("md5").update(JSON.stringify(key)).digest();
};

export class DynamoItemResource extends Construct {
  private static providerHandler: Function;
  private static provider: Provider;

  constructor(scope: Construct, id: string, props: DynamoItemResourceProps) {
    super(scope, id);

    if (!DynamoItemResource.provider) {
      DynamoItemResource.providerHandler = new Function(this, "Handler", {
        memorySize: 256,
        architecture: Architecture.ARM_64,
        timeout: Duration.seconds(30),
        runtime: Runtime.NODEJS_20_X,
        logRetention: RetentionDays.THREE_MONTHS,
        handler: "index.handler",
        code: Code.fromInline(readFileSync(join(__dirname, "dynamo_resource_lambda.js")).toString("utf-8")),
      });

      DynamoItemResource.provider = new Provider(this, "Provider", {
        onEventHandler: DynamoItemResource.providerHandler,
        logRetention: RetentionDays.THREE_DAYS,
      });
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
