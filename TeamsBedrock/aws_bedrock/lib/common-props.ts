import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';

export interface CommonAgentProps extends cdk.StackProps {
  addCommonTags?: (construct: Construct) => void;
  environment?: string;
} 