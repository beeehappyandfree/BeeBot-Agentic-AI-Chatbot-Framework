#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsBedrockStack } from '../lib/aws_bedrock-stack';

const app = new cdk.App();
new AwsBedrockStack(app, 'AwsBedrockStack', {
  environment: 'dev',
});