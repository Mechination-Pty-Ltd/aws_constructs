// import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface TmpProps {
  // Define construct properties here
}

export class Tmp extends Construct {

  constructor(scope: Construct, id: string, props: TmpProps = {}) {
    super(scope, id);

    // Define construct contents here

    // example resource
    // const queue = new sqs.Queue(this, 'TmpQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
