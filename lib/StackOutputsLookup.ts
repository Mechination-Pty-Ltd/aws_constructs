import { Construct } from "constructs";
import { Architecture, Runtime, Function, Code } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { CustomResource, Duration } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Provider } from "aws-cdk-lib/custom-resources";

const lookupStackOutputsSrc = `
const { CloudFormationClient, DescribeStacksCommand } = require("@aws-sdk/client-cloudformation");

// Turns URLs into just hostnames - used to map Lambda Function URLs to hostnames.
function transformValue(src) {
  if (typeof src === "string" && src.startsWith("https://")) {
    let modified = src.substring(8);
    if (modified.endsWith("/")) modified = modified.substring(0, modified.length - 1);
    return modified;
  }
  return src;
}

exports.handler = async function (evt) {
  const StackName = evt.ResourceProperties.StackName;
  const region = evt.ResourceProperties.region;
  const response = {};

  if (["Create", "Update"].includes(evt.RequestType)) {
    const cloudformation = new CloudFormationClient({ region });
    const stackInfo = await cloudformation.send(new DescribeStacksCommand({ StackName }));
    response.Data = Object.fromEntries(
      ((stackInfo.Stacks?.length == 1 ? stackInfo.Stacks[0].Outputs : undefined) ?? []).map((o) => [
        o.OutputKey,
        transformValue(o.OutputValue),
      ])
    );
    response.PhysicalResourceId = \`CROutput:\${StackName}:\${region}\`;
  }
  return response;
};
 `;

export interface StackOutputsLookupProps {
  region: string;
  stackName: string;
  attributes: string[];
}

export class StackOutputsLookup extends Construct {
  values: Record<string, string>;

  constructor(context: Construct, name: string, props: StackOutputsLookupProps) {
    super(context, name);

    const lookupResourceHandler = new Function(this, "LookupResource", {
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      logRetention: RetentionDays.THREE_MONTHS,
      timeout: Duration.minutes(5),
      code: Code.fromInline(lookupStackOutputsSrc),
      handler: "index.handler",
    });
    lookupResourceHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ["cloudformation:DescribeStacks"],
        resources: ["*"],
      })
    );

    const prov = new Provider(this, "InitialisationProvider", {
      onEventHandler: lookupResourceHandler,
    });

    const mainStackOutputs = new CustomResource(this, "OtherStackOutputs", {
      serviceToken: prov.serviceToken,
      properties: {
        region: props.region,
        StackName: props.stackName,
        ver: 1,
      },
    });
    this.values = {};
    for (let name of props.attributes) {
      this.values[name] = mainStackOutputs.getAttString(name);
    }
  }
}
